import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/entry/analytics/payType:
 *   post:
 *     summary: 获取支付类型分析数据
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
 *             startDay: string 开始日期（可选）
 *             endDay: string 结束日期（可选）
 *     responses:
 *       200:
 *         description: 支付类型分析数据获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: [] #[CommonChartData图表通用数据结构：支付类型分析数据数组]
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
  const body = await readBody(event); // 获取查询参数
  if (!body.bookId) {
    return error("请先选择账本");
  }

  // 构建查询条件：筛选支出类型的流水
  const where: any = {
    bookId: {
      equals: body.bookId,
    },
    flowType: "支出", // 只查询支出类型
    transferId: null, // 排除转账记录
    industryType: {
      notIn: ["借贷", "转账"], // 排除消费类型为借贷、转账的流水
    },
    eliminate: { not: 1 }, // 排除不计入收支的流水
  };

  // 添加时间范围条件
  if (body.startDay && body.endDay) {
    where.day = {
      gte: body.startDay,
      lte: body.endDay,
    };
  } else if (body.startDay) {
    where.day = {
      gte: body.startDay,
    };
  } else if (body.endDay) {
    where.day = {
      lte: body.endDay,
    };
  }

  // 按支付方式分组查询支出数据
  const payTypeGroups = await prisma.flow.groupBy({
    by: ["payType"],
    _sum: {
      money: true,
    },
    orderBy: [
      {
        payType: "asc",
      },
    ],
    where, // 使用条件查询
  });

  // 初始化结果格式
  const datas = [];
  const groupedByPayType: Record<
    string,
    {
      type: string;
      outSum: number;
    }
  > = {};

  // 按支付方式分组，合并数据到目标格式
  payTypeGroups.forEach((item) => {
    let payType = item.payType;
    // 支付方式为空时标记为"其它"
    if (!payType || payType.trim() === "") {
      payType = "其它";
    }
    
    const moneySum = item._sum.money || 0; // 如果 money 为 null，默认值为 0

    // 如果当前支付方式不存在，则初始化
    if (!groupedByPayType[payType]) {
      groupedByPayType[payType] = {
        type: payType,
        outSum: 0,
      };
    }

    // 累加支出金额
    groupedByPayType[payType].outSum += moneySum;
  });

  // 转换为数组格式
  for (const payType in groupedByPayType) {
    datas.push(groupedByPayType[payType]);
  }
  
  return success(datas);
});
