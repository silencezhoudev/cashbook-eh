import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

// 获取一级分类下的所有支出流水（industryType 以 primaryCategory 开头）
export default defineEventHandler(async (event) => {
  const { bookIds, primaryCategory, flowType, startDay, endDay } = await readBody(event);
  const userId = await getUserId(event);

  if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
    return error("请选择至少一个账本");
  }
  if (!primaryCategory) {
    return error("请选择分类");
  }

  const userBooks = await prisma.book.findMany({
    where: { userId, bookId: { in: bookIds } },
    select: { bookId: true, bookName: true, color: true }
  });
  if (userBooks.length !== bookIds.length) {
    return error("部分账本不存在或无访问权限");
  }

  let whereClause = `WHERE f."bookId" = ANY($1) AND f."userId" = $2 AND f."transferId" IS NULL AND f."industryType" NOT IN ('借贷', '转账') AND f."eliminate" != 1`;
  const queryParams: any[] = [bookIds, userId];

  // 模糊匹配一级分类（前缀）
  whereClause += ` AND f."industryType" LIKE $${queryParams.length + 1}`;
  queryParams.push(`${primaryCategory}%`);

  if (flowType) {
    whereClause += ` AND f."flowType" = $${queryParams.length + 1}`;
    queryParams.push(flowType);
  }
  if (startDay && endDay) {
    whereClause += ` AND f."day" >= $${queryParams.length + 1} AND f."day" <= $${queryParams.length + 2}`;
    queryParams.push(startDay, endDay);
  }

  const query = `
    SELECT 
      f.*,
      b."bookName",
      b."color"
    FROM "Flow" f
    LEFT JOIN "Book" b ON f."bookId" = b."bookId"
    ${whereClause}
    ORDER BY f."day" DESC
    LIMIT 1000;
  `;

  const flows: any[] = await prisma.$queryRawUnsafe(query, ...queryParams);

  const result = {
    flows: flows.map(flow => ({
      id: flow.id,
      type: 'flow',
      bookId: flow.bookId,
      day: flow.day,
      flowType: flow.flowType,
      industryType: flow.industryType,
      payType: flow.payType,
      money: parseFloat(flow.money) || 0,
      name: flow.name,
      description: flow.description,
      attribution: flow.attribution,
      book: {
        id: flow.bookId,
        bookId: flow.bookId,
        bookName: flow.bookName,
        color: flow.color
      },
      account: null, // 这个API没有查询账户信息
      transfer: null,
      originalFlow: flow
    })),
    summary: {
      totalCount: flows.length,
      totalAmount: flows.reduce((sum, flow) => sum + (parseFloat(flow.money) || 0), 0),
      primaryCategory
    }
  };

  return success(result);
});


