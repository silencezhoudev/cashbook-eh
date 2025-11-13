import prisma from "~/lib/prisma";
import { validateBookColor } from "~/server/utils/bookValidation";

/**
 * @swagger
 * /api/entry/analytics/multi-book-daily:
 *   post:
 *     summary: 获取多账本日历数据
 *     tags: ["Analytics"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookIds: string[] 账本ID数组
 *             flowType: string 流水类型（可选）
 *             startDate: string 开始日期（可选）
 *             endDate: string 结束日期（可选）
 *     responses:
 *       200:
 *         description: 多账本日历数据获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: MultiBookCalendarData
 */
export default defineEventHandler(async (event) => {
  const { bookIds, flowType, startDate, endDate } = await readBody(event);
  const userId = await getUserId(event);

  // 参数验证
  if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
    return error("请选择至少一个账本");
  }


  // 验证用户对账本的访问权限
  const userBooks = await prisma.book.findMany({
    where: { userId, bookId: { in: bookIds } },
    select: { bookId: true, bookName: true, color: true }
  });

  if (userBooks.length !== bookIds.length) {
    return error("部分账本不存在或无访问权限");
  }

  // 构建查询条件
  const where: any = {
    bookId: { in: bookIds },
    userId,
    transferId: null, // 排除转账记录
    industryType: {
      notIn: ["借贷", "转账"], // 排除消费类型为借贷、转账的流水
    },
    eliminate: { not: 1 }, // 排除不计入收支的流水
  };

  if (flowType) {
    where.flowType = flowType;
  }

  if (startDate && endDate) {
    where.day = {
      gte: startDate,
      lte: endDate
    };
  }

  // 查询流水数据
  const dayGroups = await prisma.flow.groupBy({
    by: ["day", "flowType", "bookId"],
    _sum: { money: true },
    where,
    orderBy: [
      { day: "asc" },
      { bookId: "asc" },
      { flowType: "asc" }
    ]
  });

  // 格式化数据
  const result = formatMultiBookData(dayGroups, userBooks);
  
  return success(result);
});

// 数据格式化函数
function formatMultiBookData(
  dayGroups: any[], 
  userBooks: Array<{bookId: string, bookName: string, color: string}>
) {
  const bookMap = new Map(
    userBooks.map(book => [book.bookId, book])
  );

  const result: Record<string, Record<string, any>> = {};

  dayGroups.forEach(item => {
    const { day, bookId, flowType, _sum } = item;
    const money = _sum.money || 0;
    const bookInfo = bookMap.get(bookId);

    if (!bookInfo) return;

    if (!result[day]) {
      result[day] = {};
    }

    if (!result[day][bookId]) {
      result[day][bookId] = {
        bookId,
        bookName: bookInfo.bookName,
        color: bookInfo.color,
        income: 0,
        expense: 0,
        zero: 0
      };
    }

    if (flowType === "收入") {
      result[day][bookId].income += money;
    } else if (flowType === "支出") {
      result[day][bookId].expense += money;
    } else if (flowType === "不计收支") {
      result[day][bookId].zero += money;
    } else if (["借入", "借出", "收款", "还款"].includes(flowType)) {
      // 借贷流水单独统计，不计入收支
      result[day][bookId].zero += money;
    }
  });

  return result;
}
