import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/entry/analytics/common:
 *   post:
 *     summary: 获取通用图表分析数据
 *     tags: ["Analytics"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             groupBy: string 分组字段（payType/industryType/attribution）
 *             flowType: string 流水类型（可选）
 *             startDay: string 开始日期（可选）
 *             endDay: string 结束日期（可选）
 *     responses:
 *       200:
 *         description: 通用图表分析数据获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: [] #[CommonChartData图表通用数据结构：分析数据数组]
 *       400:
 *         description: 获取失败
 *         content:
 *           application/json:
 *             schema:
 *               Error: {
 *                 message: "请先选择账本" | "不支持的分组字段"
 *               }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event); // 获取查询参数
  if (!body.bookId) {
    return error("请先选择账本");
  }

  // 验证分组字段
  const allowedGroupFields = ["payType", "industryType", "attribution"];
  if (!body.groupBy || !allowedGroupFields.includes(body.groupBy)) {
    return error("不支持的分组字段");
  }

  const where: any = {
    bookId: {
      equals: body.bookId,
    },
    transferId: null, // 排除转账记录
    industryType: {
      notIn: ["借贷", "转账"], // 排除消费类型为借贷、转账的流水
    },
    eliminate: { not: 1 }, // 排除不计入收支的流水
  };

  // 特殊处理：消费类型分析时强制筛选对应的流水类型
  if (body.groupBy === "industryType" && body.flowType === "支出") {
    where.flowType = "支出";
  } else if (body.groupBy === "industryType" && body.flowType === "收入") {
    where.flowType = "收入";
  } else if (body.flowType) {
    where.flowType = {
      equals: body.flowType,
    };
  }

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

  // 动态分组查询
  const dayGroups = await prisma.flow.groupBy({
    by: [body.groupBy, "flowType"],
    _sum: {
      money: true,
    },
    orderBy: [
      {
        [body.groupBy]: "asc",
      },
      {
        flowType: "asc",
      },
    ],
    where, // 使用条件查询
  });

  // 初始化结果格式
  const datas = [];
  const groupedByField: Record<
    string,
    {
      type: string;
      inSum: number;
      outSum: number;
      zeroSum: number;
    }
  > = {};

  // 按指定字段分组，合并数据到目标格式
  dayGroups.reduce((acc, item) => {
    let fieldValue = item[body.groupBy as keyof typeof item] as string;
    if (!fieldValue) {
      fieldValue = "未知";
    }
    
    // 如果是industryType且包含二级分类，提取一级分类
    if (body.groupBy === "industryType") {
      // 支持多种分隔符：/、-、|、、
      const separators = ["/", "-", "|", "、", " "];
      for (const sep of separators) {
        if (fieldValue.includes(sep)) {
          fieldValue = fieldValue.split(sep)[0].trim();
          break;
        }
      }
    }
    
    // 如果是payType且为空，标记为"其它"
    if (body.groupBy === "payType" && (!fieldValue || fieldValue.trim() === "")) {
      fieldValue = "其它";
    }
    
    const flowType = item.flowType;
    const moneySum = item._sum.money || 0; // 如果 money 为 null，默认值为 0

    // 如果当前字段值不存在，则初始化
    if (!acc[fieldValue]) {
      acc[fieldValue] = {
        type: fieldValue,
        inSum: 0,
        outSum: 0,
        zeroSum: 0,
      };
    }

    // 根据 flowType 填充对应的 sum
    if (flowType === "收入") {
      acc[fieldValue].inSum += moneySum;
    } else if (flowType === "支出") {
      acc[fieldValue].outSum += moneySum;
    } else if (flowType === "不计收支") {
      acc[fieldValue].zeroSum += moneySum;
    } else if (["借入", "借出", "收款", "还款"].includes(flowType)) {
      // 借贷流水单独统计，不计入收支
      acc[fieldValue].zeroSum += moneySum;
    }

    return acc;
  }, groupedByField);

  // 转换为数组格式
  for (const fieldValue in groupedByField) {
    datas.push(groupedByField[fieldValue]);
  }

  return success(datas);
});
