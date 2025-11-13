import { defineEventHandler, readBody } from 'h3';
import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/analytics/multi-book-common:
 *   post:
 *     summary: 获取多账本通用图表分析数据
 *     tags: ["Analytics"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookIds: string[] 账本ID数组
 *             groupBy: string 分组字段（payType/industryType/attribution）
 *             flowType: string 流水类型（可选）
 *             startDay: string 开始日期（可选）
 *             endDay: string 结束日期（可选）
 *     responses:
 *       200:
 *         description: 多账本通用图表分析数据获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: MultiBookCommonData
 */
export default defineEventHandler(async (event) => {
  const { bookIds, groupBy, flowType, startDay, endDay } = await readBody(event);
  const userId = await getUserId(event);

  // 参数验证
  if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
    return error("请选择至少一个账本");
  }


  // 验证分组字段
  const allowedGroupFields = ["payType", "industryType", "attribution"];
  if (!groupBy || !allowedGroupFields.includes(groupBy)) {
    return error("不支持的分组字段");
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
  // 与账户余额计算保持一致：不处理eliminate字段，但排除transferId不为null的记录
  let whereClause = `WHERE "bookId" = ANY($1) AND "userId" = $2 AND "transferId" IS NULL AND "industryType" NOT IN ('借贷', '转账')`;
  const queryParams: any[] = [bookIds, userId];

  // 根据流水类型筛选数据
  if (flowType) {
    whereClause += ` AND "flowType" = $${queryParams.length + 1}`;
    queryParams.push(flowType);
  }

  if (startDay && endDay) {
    whereClause += ` AND "day" >= $${queryParams.length + 1} AND "day" <= $${queryParams.length + 2}`;
    queryParams.push(startDay, endDay);
  }

  // 动态分组查询
  const query = `
    SELECT 
      "${groupBy}",
      "flowType",
      "bookId",
      SUM("money") AS money_sum
    FROM "Flow"
    ${whereClause}
    GROUP BY "${groupBy}", "flowType", "bookId"
    ORDER BY "${groupBy}" ASC, "bookId" ASC, "flowType" ASC;
  `;

  const groups: any[] = await prisma.$queryRawUnsafe(query, ...queryParams);

  // 格式化数据
  const result = formatMultiBookCommonData(groups, userBooks, groupBy, flowType);
  
  return success(result);
});

// 数据格式化函数
function formatMultiBookCommonData(
  groups: any[], 
  userBooks: Array<{bookId: string, bookName: string, color: string}>,
  groupBy: string,
  flowType?: string
) {
  const bookMap = new Map(
    userBooks.map(book => [book.bookId, book])
  );

  const result: Record<string, Record<string, any>> = {};

  // 如果是industryType分组，需要特殊处理账本作为一级分类的逻辑
  // 但对于收入类型分析，直接使用industryType分类，不使用账本作为分类
  if (groupBy === "industryType") {
    // 收入类型分析：直接使用industryType分类，不区分账本
    if (flowType === "收入") {
      groups.forEach(item => {
        const { bookId, flowType, money_sum, industryType } = item;
        const money = parseFloat(money_sum) || 0;
        const bookInfo = bookMap.get(bookId);
        
        if (!bookInfo) return;
        
        // 直接使用industryType作为分类，不区分账本
        let fieldValue = industryType || "未知";
        
        if (!result[fieldValue]) {
          result[fieldValue] = {};
        }

        if (!result[fieldValue][bookId]) {
          result[fieldValue][bookId] = {
            bookId,
            bookName: bookInfo.bookName,
            color: bookInfo.color,
            inSum: 0,
            outSum: 0,
            zeroSum: 0
          };
        }

        if (flowType === "收入") {
          result[fieldValue][bookId].inSum += money;
        } else if (flowType === "支出") {
          result[fieldValue][bookId].outSum += money;
        } else if (flowType === "不计收支") {
          result[fieldValue][bookId].zeroSum += money;
        } else if (["借入", "借出", "收款", "还款"].includes(flowType)) {
          // 借贷流水单独统计，不计入收支
          result[fieldValue][bookId].zeroSum += money;
        }
      });
    } else {
      // 非收入类型分析：保持原有的复杂逻辑
    // 先按账本分组，检查每个账本是否只有一级分类的industryType
    const bookHasSecondaryCategory = new Map<string, boolean>();
    
    groups.forEach(item => {
      const { bookId, industryType } = item;
      
      // 如果该账本已经发现有二级分类，跳过
      if (bookHasSecondaryCategory.get(bookId) === true) {
        return;
      }
      
      let industryTypeValue = industryType || "未知";
      // 检查是否包含二级分类分隔符
      const separators = ["/", "-", "|", "、", " "];
      let hasSecondaryCategory = false;
      for (const sep of separators) {
        if (industryTypeValue.includes(sep)) {
          hasSecondaryCategory = true;
          break;
        }
      }
      
      // 如果发现二级分类，标记该账本有二级分类
      if (hasSecondaryCategory) {
        bookHasSecondaryCategory.set(bookId, true);
      } else {
        // 如果还没有标记过，标记为只有一级分类
        if (!bookHasSecondaryCategory.has(bookId)) {
          bookHasSecondaryCategory.set(bookId, false);
        }
      }
    });
    
    // 处理数据：如果账本只有一级分类的industryType，则使用账本名作为一级分类
    groups.forEach(item => {
      const { bookId, flowType, money_sum, industryType } = item;
      const money = parseFloat(money_sum) || 0;
      const bookInfo = bookMap.get(bookId);
      
      if (!bookInfo) return;
      
      let fieldValue = industryType || "未知";
      let hasSecondaryCategory = false;
      
      // 检查当前记录是否包含二级分类
      const separators = ["/", "-", "|", "、", " "];
      for (const sep of separators) {
        if (fieldValue.includes(sep)) {
          hasSecondaryCategory = true;
          fieldValue = fieldValue.split(sep)[0].trim();
          break;
        }
      }
      
      // 如果该账本只有一级分类的industryType，使用账本名作为分类
      const bookOnlyHasPrimaryCategory = bookHasSecondaryCategory.get(bookId) === false;
      if (bookOnlyHasPrimaryCategory && !hasSecondaryCategory) {
        // 使用账本名作为一级分类
        fieldValue = bookInfo.bookName;
      }
      
      if (!result[fieldValue]) {
        result[fieldValue] = {};
      }

      if (!result[fieldValue][bookId]) {
        result[fieldValue][bookId] = {
          bookId,
          bookName: bookInfo.bookName,
          color: bookInfo.color,
          inSum: 0,
          outSum: 0,
          zeroSum: 0
        };
      }

      if (flowType === "收入") {
        result[fieldValue][bookId].inSum += money;
      } else if (flowType === "支出") {
        result[fieldValue][bookId].outSum += money;
      } else if (flowType === "不计收支") {
        result[fieldValue][bookId].zeroSum += money;
      } else if (["借入", "借出", "收款", "还款"].includes(flowType)) {
        // 借贷流水单独统计，不计入收支
        result[fieldValue][bookId].zeroSum += money;
      }
    });
    }
  } else {
    // 其他分组字段保持原有逻辑
    groups.forEach(item => {
      let fieldValue = item[groupBy] || "未知";
      
      // 如果是payType且为空，标记为"其它"
      if (groupBy === "payType" && (!fieldValue || fieldValue.trim() === "")) {
        fieldValue = "其它";
      }
      
      const { bookId, flowType, money_sum } = item;
      const money = parseFloat(money_sum) || 0;
      const bookInfo = bookMap.get(bookId);

      if (!bookInfo) return;

      if (!result[fieldValue]) {
        result[fieldValue] = {};
      }

      if (!result[fieldValue][bookId]) {
        result[fieldValue][bookId] = {
          bookId,
          bookName: bookInfo.bookName,
          color: bookInfo.color,
          inSum: 0,
          outSum: 0,
          zeroSum: 0
        };
      }

      if (flowType === "收入") {
        result[fieldValue][bookId].inSum += money;
      } else if (flowType === "支出") {
        result[fieldValue][bookId].outSum += money;
      } else if (flowType === "不计收支") {
        result[fieldValue][bookId].zeroSum += money;
      } else if (["借入", "借出", "收款", "还款"].includes(flowType)) {
        // 借贷流水单独统计，不计入收支
        result[fieldValue][bookId].zeroSum += money;
      }
    });
  }

  return result;
}
