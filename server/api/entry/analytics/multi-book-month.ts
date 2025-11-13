import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/analytics/multi-book-month:
 *   post:
 *     summary: 获取多账本月度分析数据
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
 *         description: 多账本月度分析数据获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: MultiBookMonthData
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
  let whereClause = `WHERE "bookId" = ANY($1) AND "userId" = $2 AND "transferId" IS NULL AND "industryType" NOT IN ('借贷', '转账') AND "eliminate" != 1`;
  const queryParams: any[] = [bookIds, userId];

  if (flowType) {
    whereClause += ` AND "flowType" = $${queryParams.length + 1}`;
    queryParams.push(flowType);
  }

  if (startDate && endDate) {
    whereClause += ` AND "day" >= $${queryParams.length + 1} AND "day" <= $${queryParams.length + 2}`;
    queryParams.push(startDate, endDate);
  }

  // 使用原生SQL查询月度数据
  const query = `
    SELECT 
      SUBSTRING(day, 1, 7) AS month,
      "flowType",
      "bookId",
      SUM("money") AS money_sum
    FROM "Flow"
    ${whereClause}
    GROUP BY SUBSTRING(day, 1, 7), "flowType", "bookId"
    ORDER BY month ASC, "bookId" ASC, "flowType" ASC;
  `;

  const monthGroups: any[] = await prisma.$queryRawUnsafe(query, ...queryParams);

  // 格式化数据
  const result = formatMultiBookMonthData(monthGroups, userBooks);
  
  return success(result);
});

// 数据格式化函数
function formatMultiBookMonthData(
  monthGroups: any[], 
  userBooks: Array<{bookId: string, bookName: string, color: string}>
) {
  const bookMap = new Map(
    userBooks.map(book => [book.bookId, book])
  );

  const result: Record<string, Record<string, any>> = {};

  monthGroups.forEach(item => {
    const { month, bookId, flowType, money_sum } = item;
    const money = parseFloat(money_sum) || 0;
    const bookInfo = bookMap.get(bookId);

    if (!bookInfo) return;

    if (!result[month]) {
      result[month] = {};
    }

    if (!result[month][bookId]) {
      result[month][bookId] = {
        bookId,
        bookName: bookInfo.bookName,
        color: bookInfo.color,
        inSum: 0,
        outSum: 0,
        zeroSum: 0
      };
    }

    if (flowType === "收入") {
      result[month][bookId].inSum += money;
    } else if (flowType === "支出") {
      result[month][bookId].outSum += money;
    } else if (flowType === "不计收支") {
      result[month][bookId].zeroSum += money;
    } else if (["借入", "借出", "收款", "还款"].includes(flowType)) {
      // 借贷流水单独统计，不计入收支
      result[month][bookId].zeroSum += money;
    }
  });

  return result;
}
