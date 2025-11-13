import { defineEventHandler, readBody } from 'h3';
import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/analytics/monthly-asset-cumulative:
 *   post:
 *     summary: 获取月度资产累计数据
 *     tags: ["Analytics"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID（忽略，计算所有账本）
 *             startMonth: string 开始月份（YYYY-MM格式，可选）
 *             endMonth: string 结束月份（YYYY-MM格式，可选）
 *             onlyIncludedAccounts: boolean 是否只计算计入总资产账户（默认false，计算所有账户）
 *     responses:
 *       200:
 *         description: 月度资产累计数据获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result: {
 *                 d: [{
 *                   month: string,  // 月份 YYYY-MM
 *                   totalBalance: number,  // 截止到该月的总资产
 *                   accountCount: number  // 账户数量
 *                 }],
 *                 yearlyGrowth: number  // 年度增长（包括所有月份的净变化，包括1月）
 *               }
 *       400:
 *         description: 获取失败
 * 
 * 计算说明：
 * onlyIncludedAccounts = false（默认）：
 * 1. 计算所有账户的收支流水（收入-支出）
 * 2. 转账不影响总资产（因为所有账户都计算，转账只是内部转移）
 * 3. 月度净变化 = 收支净变化
 * 
 * onlyIncludedAccounts = true：
 * 1. 只计算计入总资产账户的收支流水（收入-支出）
 * 2. 计算跨边界转账的影响（从计入总资产转到不计入总资产，或从不计入总资产转到计入总资产）
 * 3. 月度净变化 = 收支净变化 + 转账影响
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const userId = await getUserId(event);
  
  // 获取onlyIncludedAccounts参数（默认false，计算所有账户）
  const onlyIncludedAccounts = body.onlyIncludedAccounts === true;
  
  // 根据onlyIncludedAccounts参数决定查询哪些账户
  const accounts = await prisma.account.findMany({
    where: {
      userId: userId,
      ...(onlyIncludedAccounts ? { includeInTotal: true } : {})
    },
    orderBy: { createDate: 'asc' }
  });

  if (accounts.length === 0) {
    return success([]);
  }

  const accountIds = accounts.map((acc: any) => acc.id);

  // 获取所有账本的所有流水记录（仅计入账户相关流水）
  const flows = await prisma.flow.findMany({
    where: {
      userId: userId,
      accountId: {
        in: accountIds
      },
      eliminate: { not: 1 }, // 排除不计入收支的流水
      transferId: null // 排除由转账生成的账户级流水，避免与 Transfer 汇总重复计算
    },
    orderBy: { day: 'asc' }
  });

  // 获取转账记录
  let transfers: any[] = [];
  let accountIncludeMap: Map<number, boolean> | null = null;
  
  if (onlyIncludedAccounts) {
    // 只计算计入总资产账户时，需要计算跨边界转账影响
    // 获取所有账户（用于判断转账是否跨边界）
    const allAccounts = await prisma.account.findMany({
      where: {
        userId: userId
      },
      select: {
        id: true,
        includeInTotal: true
      }
    });

    // 建立账户ID到includeInTotal的映射
    accountIncludeMap = new Map<number, boolean>();
    allAccounts.forEach((acc: any) => {
      accountIncludeMap!.set(acc.id, acc.includeInTotal !== false);
    });

    // 获取所有转账记录（涉及计入总资产账户的转账）
    transfers = await prisma.transfer.findMany({
      where: {
        OR: [
          { fromAccountId: { in: accountIds } },
          { toAccountId: { in: accountIds } }
        ]
      },
      orderBy: { day: 'asc' }
    });
  } else {
    // 计算所有账户时，不需要计算转账影响（转账不影响总资产）
    // transfers保持为空数组
  }

  // 如果没有流水数据，返回当前所有账户的总余额
  if (flows.length === 0 && transfers.length === 0) {
    const currentTotal = accounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    return success([{
      month: currentMonth,
      totalBalance: currentTotal,
      accountCount: accounts.length
    }]);
  }

  // 仅基于“收支”构建月度净变化：净变动 = 收入 - 支出
  const incomeExpenseChangeByMonth: { [key: string]: number } = {};
  flows.forEach((flow: any) => {
    const month = flow.day.substring(0, 7);
    if (!incomeExpenseChangeByMonth[month]) incomeExpenseChangeByMonth[month] = 0;
    if (flow.flowType === '收入') {
      incomeExpenseChangeByMonth[month] += flow.money || 0;
    } else if (flow.flowType === '支出') {
      incomeExpenseChangeByMonth[month] -= (flow.money || 0);
    } else {
      // 忽略借贷等类型，使口径与“当月收支”一致
    }
  });

  // 计算转账对总资产的影响
  const transferImpactByMonth: { [key: string]: number } = {};
  
  if (onlyIncludedAccounts && accountIncludeMap) {
    // 只计算计入总资产账户时，需要计算跨边界转账影响
    transfers.forEach((transfer: any) => {
      const month = transfer.day.substring(0, 7);
      if (!transferImpactByMonth[month]) {
        transferImpactByMonth[month] = 0;
      }

      const fromIncluded = accountIncludeMap!.get(transfer.fromAccountId) || false;
      const toIncluded = accountIncludeMap!.get(transfer.toAccountId) || false;
      const amount = transfer.amount || 0;

      // 只计算跨边界转账的影响
      if (fromIncluded && !toIncluded) {
        // 从计入总资产转到不计入总资产：减少总资产
        transferImpactByMonth[month] -= amount;
      } else if (!fromIncluded && toIncluded) {
        // 从不计入总资产转到计入总资产：增加总资产
        transferImpactByMonth[month] += amount;
      }
      // 其他情况（两个账户都计入总资产，或两个账户都不计入总资产）不影响总资产，不计算
    });
  }
  // 计算所有账户时，不计算转账影响（转账不影响总资产）

  // 合并收支和转账的月度净变化
  const netChangeByMonth: { [key: string]: number } = {};
  // 获取所有涉及的月份
  const allMonthsSet = new Set<string>([
    ...Object.keys(incomeExpenseChangeByMonth),
    ...Object.keys(transferImpactByMonth)
  ]);
  
  allMonthsSet.forEach(month => {
    netChangeByMonth[month] = (incomeExpenseChangeByMonth[month] || 0) + (transferImpactByMonth[month] || 0);
  });

  // 获取所有涉及的月份区间（若为空，则以当前月为唯一月份）
  const monthSet = new Set<string>([...Object.keys(netChangeByMonth)]);
  const currentMonth = new Date().toISOString().substring(0, 7);
  if (monthSet.size === 0) {
    monthSet.add(currentMonth);
    netChangeByMonth[currentMonth] = 0;
  }

  // 从最早月份到当前月份，生成完整连续月份序列
  const sortedExisting = Array.from(monthSet).sort();
  const firstMonth = sortedExisting[0];
  
  // 计算第一个点的上一个月，用于计算第一个点的相对增长
  const generatePrevMonth = (month: string): string => {
    const year = parseInt(month.substring(0, 4));
    const monthNum = parseInt(month.substring(5, 7));
    if (monthNum === 1) {
      return `${year - 1}-12`;
    } else {
      const prevMonthNum = monthNum - 1;
      return `${year}-${prevMonthNum < 10 ? '0' : ''}${prevMonthNum}`;
    }
  };
  const prevMonthOfFirst = generatePrevMonth(firstMonth);
  
  const generateMonthSequence = (start: string, end: string): string[] => {
    const result: string[] = [];
    let year = parseInt(start.substring(0, 4));
    let month = parseInt(start.substring(5, 7));
    const endYear = parseInt(end.substring(0, 4));
    const endMonth = parseInt(end.substring(5, 7));
    while (year < endYear || (year === endYear && month <= endMonth)) {
      const m = month < 10 ? `0${month}` : `${month}`;
      result.push(`${year}-${m}`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return result;
  };
  // 往前多包含一个月，用于计算第一个点的相对增长
  const sortedMonths = generateMonthSequence(prevMonthOfFirst, currentMonth);
  
  const monthlyData: { [key: string]: { month: string; totalBalance: number; accountCount: number } } = {};

  // 以“当前总资产”为锚点，按月反推历史月度期末余额
  const currentTotal = accounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
  const totalsByMonth: { [key: string]: number } = {};
  // 先把当前月的期末余额设为当前总资产
  totalsByMonth[currentMonth] = currentTotal;
  // 逆序遍历月份序列：prev = next - netChange[next]
  for (let i = sortedMonths.length - 2; i >= 0; i--) {
    const nextMonth = sortedMonths[i + 1];
    const prevMonth = sortedMonths[i];
    const delta = netChangeByMonth[nextMonth] || 0;
    totalsByMonth[prevMonth] = (totalsByMonth[nextMonth] || 0) - delta;
  }
  // 同步构建 monthlyData
  sortedMonths.forEach(m => {
    monthlyData[m] = {
      month: m,
      totalBalance: totalsByMonth[m] ?? 0,
      accountCount: accounts.length
    };
  });

  // 转换为数组并按月份排序（不再对当前月做特殊覆盖）
  const result = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
  
  // 计算本年度总增长金额（包括所有月份的净变化，包括1月）
  let yearlyGrowth = 0;
  if (result.length > 0) {
    // 根据请求的年份计算增长，如果没有指定则使用当前年份
    let targetYear = new Date().getFullYear();
    if (body.startMonth) {
      targetYear = parseInt(body.startMonth.substring(0, 4));
    } else if (body.endMonth) {
      targetYear = parseInt(body.endMonth.substring(0, 4));
    }
    
    const yearStartMonth = `${targetYear}-01`;
    const yearEndMonth = `${targetYear}-12`;
    
    // 计算年度增长：所有月份的净变化之和（包括1月）
    // 包括收支净变化和转账影响
    sortedMonths.forEach(month => {
      if (month >= yearStartMonth && month <= yearEndMonth) {
        yearlyGrowth += netChangeByMonth[month] || 0;
      }
    });
  }
  
  // 如果指定了时间范围，进行过滤
  if (body.startMonth || body.endMonth) {
    // 如果startMonth是某年的1月，自动包含上一年的12月数据（用于计算1月份的资产变动）
    // 但这个数据点只用于计算，前端会过滤掉不在指定年份的数据点
    let actualStartMonth = body.startMonth;
    if (body.startMonth && body.startMonth.endsWith('-01')) {
      const year = parseInt(body.startMonth.substring(0, 4));
      const prevYear = year - 1;
      const prevMonth = `${prevYear}-12`;
      // 检查数据中是否包含上个月的数据
      if (result.some(item => item.month === prevMonth)) {
        actualStartMonth = prevMonth;
      }
    }
    
    // 计算过滤后第一个点的上一个月，便于计算相对增长
    const filteredResult = result.filter(item => {
      if (actualStartMonth && item.month < actualStartMonth) return false;
      if (body.endMonth && item.month > body.endMonth) return false;
      return true;
    });
    
    // 如果过滤后的结果不为空，检查第一个点是否有上一个月的数据
    // 如果上一个月的数据存在，添加进来（前端会过滤掉不在指定年份的数据点）
    if (filteredResult.length > 0) {
      const firstFilteredMonth = filteredResult[0].month;
      const prevMonthOfFirstFiltered = generatePrevMonth(firstFilteredMonth);
      // 如果上一个月的数据存在且不在过滤结果中，添加进来
      const prevMonthData = result.find(item => item.month === prevMonthOfFirstFiltered);
      if (prevMonthData && !filteredResult.some(item => item.month === prevMonthOfFirstFiltered)) {
        filteredResult.unshift(prevMonthData);
        // 重新排序
        filteredResult.sort((a, b) => a.month.localeCompare(b.month));
      }
    }
    
    // 返回的数据包含上一年的12月（如果存在），但前端会过滤掉不在指定年份的数据点
    return success({
      data: filteredResult,
      yearlyGrowth: yearlyGrowth
    });
  }

  return success({
    data: result,
    yearlyGrowth: yearlyGrowth
  });
});