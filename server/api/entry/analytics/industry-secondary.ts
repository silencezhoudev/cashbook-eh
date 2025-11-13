import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/analytics/industry-secondary:
 *   post:
 *     summary: 获取行业类型二级分类分析数据
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
 *             flowType: string 流水类型（可选）
 *             startDay: string 开始日期（可选）
 *             endDay: string 结束日期（可选）
 *     responses:
 *       200:
 *         description: 行业类型二级分类分析数据获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: IndustrySecondaryData
 */
export default defineEventHandler(async (event) => {
  const { bookIds, primaryCategory, flowType, startDay, endDay } = await readBody(event);
  const userId = await getUserId(event);

  // 参数验证
  if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
    return error("请选择至少一个账本");
  }

  if (!primaryCategory) {
    return error("请选择一级分类");
  }

  // 验证用户对账本的访问权限
  const userBooks = await prisma.book.findMany({
    where: { userId, bookId: { in: bookIds } },
    select: { bookId: true, bookName: true, color: true }
  });

  if (userBooks.length !== bookIds.length) {
    return error("部分账本不存在或无访问权限");
  }

  // 检查primaryCategory是否是账本名称
  const isBookName = userBooks.some(book => book.bookName === primaryCategory);
  
  // 构建查询条件
  let whereClause = `WHERE "bookId" = ANY($1) AND "userId" = $2 AND "transferId" IS NULL AND "industryType" NOT IN ('借贷', '转账') AND "eliminate" != 1`;
  const queryParams: any[] = [bookIds, userId];

  if (isBookName) {
    // 如果是账本名称，筛选该账本的数据
    const targetBook = userBooks.find(book => book.bookName === primaryCategory);
    if (targetBook) {
      whereClause += ` AND "bookId" = $${queryParams.length + 1}`;
      queryParams.push(targetBook.bookId);
    }
  } else {
    // 如果不是账本名称，按industryType筛选
    whereClause += ` AND "industryType" LIKE $${queryParams.length + 1}`;
    queryParams.push(`${primaryCategory}%`);
  }

  // 根据流水类型筛选数据
  if (flowType) {
    whereClause += ` AND "flowType" = $${queryParams.length + 1}`;
    queryParams.push(flowType);
  }

  if (startDay && endDay) {
    whereClause += ` AND "day" >= $${queryParams.length + 1} AND "day" <= $${queryParams.length + 2}`;
    queryParams.push(startDay, endDay);
  }

  // 查询二级分类数据
  const query = `
    SELECT 
      "industryType",
      "flowType",
      "bookId",
      SUM("money") AS money_sum
    FROM "Flow"
    ${whereClause}
    GROUP BY "industryType", "flowType", "bookId"
    ORDER BY "industryType" ASC, "bookId" ASC, "flowType" ASC;
  `;

  const groups: any[] = await prisma.$queryRawUnsafe(query, ...queryParams);

  // 格式化数据
  const result = formatIndustrySecondaryData(groups, userBooks, primaryCategory, isBookName);
  
  return success(result);
});

// 数据格式化函数
function formatIndustrySecondaryData(
  groups: any[], 
  userBooks: Array<{bookId: string, bookName: string, color: string}>,
  primaryCategory: string,
  isBookName: boolean
) {
  const bookMap = new Map(
    userBooks.map(book => [book.bookId, book])
  );

  const result: Record<string, Record<string, any>> = {};
  
  if (isBookName) {
    // 如果primaryCategory是账本名称，则显示该账本下的所有支出类型作为二级分类
    groups.forEach(item => {
      const { bookId, flowType, money_sum, industryType } = item;
      const money = parseFloat(money_sum) || 0;
      const bookInfo = bookMap.get(bookId);

      if (!bookInfo || bookInfo.bookName !== primaryCategory) return;

      // 使用industryType作为二级分类
      let secondaryCategory = industryType || "未知";
      
      // 如果industryType包含分隔符，提取二级分类
      const separators = ["/", "-", "|", "、", " "];
      for (const sep of separators) {
        if (secondaryCategory.includes(sep)) {
          const parts = secondaryCategory.split(sep);
          if (parts.length > 1) {
            secondaryCategory = parts[1].trim();
          } else {
            secondaryCategory = parts[0].trim();
          }
          break;
        }
      }
      
      // 如果二级分类为空，使用"其他"
      if (!secondaryCategory || secondaryCategory.trim() === "") {
        secondaryCategory = "其他";
      }

      if (!result[secondaryCategory]) {
        result[secondaryCategory] = {};
      }

      if (!result[secondaryCategory][bookId]) {
        result[secondaryCategory][bookId] = {
          bookId,
          bookName: bookInfo.bookName,
          color: bookInfo.color,
          inSum: 0,
          outSum: 0,
          zeroSum: 0
        };
      }

      if (flowType === "收入") {
        result[secondaryCategory][bookId].inSum += money;
      } else if (flowType === "支出") {
        result[secondaryCategory][bookId].outSum += money;
      } else if (flowType === "不计收支") {
        result[secondaryCategory][bookId].zeroSum += money;
      } else if (["借入", "借出", "收款", "还款"].includes(flowType)) {
        // 借贷流水单独统计，不计入收支
        result[secondaryCategory][bookId].zeroSum += money;
      }
    });
  } else {
    // 原有逻辑：处理industryType的二级分类
    groups.forEach(item => {
      let fieldValue = item.industryType || "未知";
      
      // 提取二级分类名称
      let secondaryCategory = fieldValue;
      
      // 支持多种分隔符：/、-、|、、
      const separators = ["/", "-", "|", "、", " "];
      for (const sep of separators) {
        if (fieldValue.includes(sep)) {
          const parts = fieldValue.split(sep);
          if (parts.length > 1) {
            secondaryCategory = parts[1].trim();
            break;
          }
        }
      }
      
      // 如果二级分类为空，使用"其他"
      if (!secondaryCategory || secondaryCategory.trim() === "") {
        secondaryCategory = "其他";
      }
      
      const { bookId, flowType, money_sum } = item;
      const money = parseFloat(money_sum) || 0;
      const bookInfo = bookMap.get(bookId);

      if (!bookInfo) return;

      if (!result[secondaryCategory]) {
        result[secondaryCategory] = {};
      }

      if (!result[secondaryCategory][bookId]) {
        result[secondaryCategory][bookId] = {
          bookId,
          bookName: bookInfo.bookName,
          color: bookInfo.color,
          inSum: 0,
          outSum: 0,
          zeroSum: 0
        };
      }

      if (flowType === "收入") {
        result[secondaryCategory][bookId].inSum += money;
      } else if (flowType === "支出") {
        result[secondaryCategory][bookId].outSum += money;
      } else if (flowType === "不计收支") {
        result[secondaryCategory][bookId].zeroSum += money;
      } else if (["借入", "借出", "收款", "还款"].includes(flowType)) {
        // 借贷流水单独统计，不计入收支
        result[secondaryCategory][bookId].zeroSum += money;
      }
    });
  }

  return result;
}
