import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/entry/analytics/daily:
 *   post:
 *     summary: 获取日常流水分析数据
 *     tags: ["Analytics"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             flowType: string 流水类型（可选）
 *     responses:
 *       200:
 *         description: 日常分析数据获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: [] #[CommonChartData图表通用数据结构：日常流水分析数据数组]
 *       400:
 *         description: 获取失败
 *         content:
 *           application/json:
 *             schema:
 *               Error: {
 *                 message: "请先选择账本"
 *               }
 */
export default defineEventHandler(async (event) => {
  const { bookId, flowType } = await readBody(event); // 获取查询参数
  if (!bookId) {
    return error("请先选择账本");
  }

  const where: any = {
    bookId,
    transferId: null, // 排除转账记录
    industryType: {
      notIn: ["借贷", "转账"], // 排除消费类型为借贷、转账的流水
    },
  }; // 条件查询

  if (flowType) {
    where.flowType = {
      equals: flowType,
    };
  }

  // 收入/支出（排除不计收支 eliminate=1）
  const ioGroups = await prisma.flow.groupBy({
    by: ["day", "flowType"],
    _sum: { money: true },
    where: { ...where, eliminate: { not: 1 } },
    orderBy: [ { day: "asc" }, { flowType: "asc" } ],
  });

  // 不计收支（eliminate=1），无视 flowType
  const zeroGroups = await prisma.flow.groupBy({
    by: ["day"],
    _sum: { money: true },
    where: { ...where, eliminate: 1 },
    orderBy: [ { day: "asc" } ],
  });

  // 借贷流水（借入、借出、收款、还款）
  const loanGroups = await prisma.flow.groupBy({
    by: ["day"],
    _sum: { money: true },
    where: { 
      ...where, 
      flowType: { in: ["借入", "借出", "收款", "还款"] }
    },
    orderBy: [ { day: "asc" } ],
  });

  // 初始化结果格式
  const datas = [];
  const groupedByDay: Record<
    string,
    {
      type: string;
      inSum: number;
      outSum: number;
      zeroSum: number;
    }
  > = {};
  // 按 day 分组，合并数据到目标格式
  ioGroups.reduce((acc, item) => {
    const day = item.day;
    const flowType = item.flowType;
    const moneySum = item._sum.money || 0; // 如果 money 为 null，默认值为 0

    // 如果当前 day 不存在，则初始化
    if (!acc[day]) {
      acc[day] = {
        type: day,
        inSum: 0,
        outSum: 0,
        zeroSum: 0,
      };
    }

    // 根据 flowType 填充对应的 sum
    if (flowType === "收入") {
      acc[day].inSum += moneySum;
    } else if (flowType === "支出") {
      acc[day].outSum += moneySum;
    }

    return acc;
  }, groupedByDay);

  // 合并不计收支
  zeroGroups.forEach((item) => {
    const day = item.day as string;
    const moneySum = item._sum.money || 0;
    if (!groupedByDay[day]) {
      groupedByDay[day] = { type: day, inSum: 0, outSum: 0, zeroSum: 0 };
    }
    groupedByDay[day].zeroSum += moneySum;
  });

  // 合并借贷流水
  loanGroups.forEach((item) => {
    const day = item.day as string;
    const moneySum = item._sum.money || 0;
    if (!groupedByDay[day]) {
      groupedByDay[day] = { type: day, inSum: 0, outSum: 0, zeroSum: 0 };
    }
    groupedByDay[day].zeroSum += moneySum;
  });

  // 转换为数组格式
  for (const day in groupedByDay) {
    groupedByDay[day].inSum = parseFloat(groupedByDay[day].inSum.toFixed(2));
    groupedByDay[day].outSum = parseFloat(groupedByDay[day].outSum.toFixed(2));
    groupedByDay[day].zeroSum = parseFloat(
      groupedByDay[day].zeroSum.toFixed(2)
    );
    datas.push(groupedByDay[day]);
  }
  return success(datas);
});
