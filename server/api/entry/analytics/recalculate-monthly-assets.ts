import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/analytics/recalculate-monthly-assets:
 *   post:
 *     summary: 重新计算月度资产累计数据（修复流水时间修改后的数据不一致问题）
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
 *     responses:
 *       200:
 *         description: 重新计算完成
 *         content:
 *           application/json:
 *             schema:
 *               Result: {
 *                 d: [{
 *                   month: string,  // 月份 YYYY-MM
 *                   totalBalance: number,  // 截止到该月的总资产
 *                   accountCount: number  // 账户数量
 *                 }]
 *               }
 *       400:
 *         description: 重新计算失败
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const userId = await getUserId(event);
  
  // 获取所有账户（忽略"不计入总资产"标记，计算所有账户）
  const accounts = await prisma.account.findMany({
    where: {
      userId: userId
    },
    orderBy: { createDate: 'asc' }
  });

  if (accounts.length === 0) {
    return success([]);
  }

  // 获取所有账本的所有流水记录（不限制账本）
  const flows = await prisma.flow.findMany({
    where: {
      userId: userId,
      accountId: {
        in: accounts.map((acc: any) => acc.id)
      },
      eliminate: { not: 1 }, // 排除不计入收支的流水
      transferId: null // 排除由转账生成的账户级流水，避免与 Transfer 汇总重复计算
    },
    orderBy: { day: 'asc' }
  });

  // 获取所有转账记录
  const transfers = await prisma.transfer.findMany({
    where: {
      OR: [
        { fromAccountId: { in: accounts.map((acc: any) => acc.id) } },
        { toAccountId: { in: accounts.map((acc: any) => acc.id) } }
      ]
    },
    orderBy: { createDate: 'asc' }
  });

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

  // 按月份分组处理流水
  const flowsByMonth: { [key: string]: any[] } = {};
  
  flows.forEach((flow: any) => {
    const month = flow.day.substring(0, 7); // 提取 YYYY-MM
    if (!flowsByMonth[month]) {
      flowsByMonth[month] = [];
    }
    flowsByMonth[month].push(flow);
  });

  // 按月份分组处理转账
  const transfersByMonth: { [key: string]: any[] } = {};
  
  transfers.forEach((transfer: any) => {
    const month = transfer.createDate.toISOString().substring(0, 7); // 提取 YYYY-MM
    if (!transfersByMonth[month]) {
      transfersByMonth[month] = [];
    }
    transfersByMonth[month].push(transfer);
  });

  // 获取所有涉及的月份
  const allMonths = new Set([...Object.keys(flowsByMonth), ...Object.keys(transfersByMonth)]);
  const sortedMonths = Array.from(allMonths).sort();
  
  // 生成完整的月份列表（从最早月份到当前月份）
  const currentMonth = new Date().toISOString().substring(0, 7);
  const earliestMonth = sortedMonths[0] || currentMonth;
  
  const allMonthsList = [];
  const startDate = new Date(earliestMonth + '-01');
  const endDate = new Date(currentMonth + '-01');
  
  for (let date = new Date(startDate); date <= endDate; date.setMonth(date.getMonth() + 1)) {
    const monthStr = date.toISOString().substring(0, 7);
    allMonthsList.push(monthStr);
  }
  
  const result = [];
  
  // 重新计算每个月的余额
  const accountBalances: { [key: number]: number } = {};
  accounts.forEach((account: any) => {
    accountBalances[account.id] = 0; // 从0开始
  });
  
  allMonthsList.forEach(month => {
    const monthFlows = flowsByMonth[month] || [];
    const monthTransfers = transfersByMonth[month] || [];
    
    // 处理该月的所有流水
    monthFlows.forEach(flow => {
      const accountId = flow.accountId!;
      
      if (['收入', '借入', '收款'].includes(flow.flowType)) {
        accountBalances[accountId] += flow.money || 0;
      } else if (['支出', '借出', '还款'].includes(flow.flowType)) {
        accountBalances[accountId] -= flow.money || 0;
      }
    });
    
    // 处理该月的所有转账
    monthTransfers.forEach(transfer => {
      if (transfer.fromAccountId && accountBalances[transfer.fromAccountId] !== undefined) {
        accountBalances[transfer.fromAccountId] -= transfer.amount || 0;
      }
      if (transfer.toAccountId && accountBalances[transfer.toAccountId] !== undefined) {
        accountBalances[transfer.toAccountId] += transfer.amount || 0;
      }
    });
    
    // 计算该月月末的总资产
    let totalBalance = 0;
    Object.values(accountBalances).forEach(balance => {
      totalBalance += balance;
    });
    
    result.push({
      month: month,
      totalBalance: totalBalance,
      accountCount: accounts.length
    });
  });
  
  // 如果指定了时间范围，进行过滤
  if (body.startMonth || body.endMonth) {
    return success(result.filter(item => {
      if (body.startMonth && item.month < body.startMonth) return false;
      if (body.endMonth && item.month > body.endMonth) return false;
      return true;
    }));
  }

  return success(result);
});
