import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/analytics/category-flows:
 *   post:
 *     summary: 获取指定分类的流水详情数据
 *     tags: ["Analytics"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookIds: string[] 账本ID数组
 *             primaryCategory: string 一级分类名称
 *             secondaryCategory: string 二级分类名称
 *             flowType: string 流水类型（可选）
 *             startDay: string 开始日期（可选）
 *             endDay: string 结束日期（可选）
 *     responses:
 *       200:
 *         description: 指定分类的流水详情数据获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: CategoryFlowsData
 */
export default defineEventHandler(async (event) => {
  const { bookIds, primaryCategory, secondaryCategory, flowType, startDay, endDay, actualIndustryTypes, actualBookNames } = await readBody(event);
  const userId = await getUserId(event);

  if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
    return error("请选择至少一个账本");
  }

  if (!primaryCategory || (!secondaryCategory && !(actualIndustryTypes && actualIndustryTypes.length > 0))) {
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

  const isBookName = userBooks.some(book => book.bookName === primaryCategory);
  
  if ((actualIndustryTypes && Array.isArray(actualIndustryTypes) && actualIndustryTypes.length > 0) || (actualBookNames && Array.isArray(actualBookNames) && actualBookNames.length > 0)) {
    let orConditions: string[] = [];
    let orParams: any[] = [];
    if (actualIndustryTypes && actualIndustryTypes.length > 0) {
      orConditions.push(`f."industryType" = ANY($${queryParams.length + 1})`);
      orParams.push(actualIndustryTypes);
    }
    if (actualBookNames && actualBookNames.length > 0) {
      const matchedBooks = userBooks.filter(book => actualBookNames.includes(book.bookName));
      const matchedBookIds = matchedBooks.map(book => book.bookId);
      if (matchedBookIds.length > 0) {
        const sepRegex = "[\\/\\-\\|、\\s]";
        orConditions.push(`(f."bookId" = ANY($${queryParams.length + orParams.length + 1}) AND (f."industryType" IS NULL OR f."industryType" !~ '${sepRegex}'))`);
        orParams.push(matchedBookIds);
      }
    }
    whereClause += ` AND (${orConditions.join(' OR ')})`;
    queryParams.push(...orParams);
  } else if (isBookName) {
    const targetBook = userBooks.find(book => book.bookName === primaryCategory);
    if (targetBook) {
      if (!secondaryCategory || secondaryCategory === '全部') {
        whereClause += ` AND f."bookId" = $${queryParams.length + 1}`;
        queryParams.push(targetBook.bookId);
      } else {
        whereClause += ` AND f."bookId" = $${queryParams.length + 1} AND f."industryType" = $${queryParams.length + 2}`;
        queryParams.push(targetBook.bookId, secondaryCategory);
      }
    }
  } else {
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const primaryEsc = escapeRegex(primaryCategory.trim());
    const secondaryEsc = escapeRegex(String(secondaryCategory).trim());
    const regex = `^${primaryEsc}\\s*(?:[\\/\\-|、\\s])\\s*${secondaryEsc}$`;
    whereClause += ` AND f."industryType" ~ $${queryParams.length + 1}`;
    queryParams.push(regex);
  }

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
      account: null,
      transfer: null,
      originalFlow: flow
    })),
    summary: {
      totalCount: flows.length,
      totalAmount: flows.reduce((sum, flow) => sum + (parseFloat(flow.money) || 0), 0),
      primaryCategory,
      secondaryCategory
    }
  };

  return success(result);
});


