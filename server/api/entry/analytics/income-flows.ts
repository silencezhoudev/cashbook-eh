import { defineEventHandler, readBody } from 'h3';
import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/analytics/income-flows:
 *   post:
 *     summary: 获取收入流水记录
 *     tags: ["Analytics"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookIds: string[] 账本ID数组
 *             industryType: string 收入类型
 *             flowType: string 流水类型（收入）
 *             startDay: string 开始日期（可选）
 *             endDay: string 结束日期（可选）
 *             pageNum: number 页码
 *             pageSize: number 每页大小
 *     responses:
 *       200:
 *         description: 收入流水记录获取成功
 */
export default defineEventHandler(async (event) => {
  const { bookIds, industryType, flowType, startDay, endDay, pageNum = 1, pageSize = 100 } = await readBody(event);
  const userId = await getUserId(event);

  if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
    return error("请选择至少一个账本");
  }

  if (!industryType) {
    return error("请指定收入类型");
  }

  if (flowType !== "收入") {
    return error("只支持收入流水查询");
  }

  const userBooks = await prisma.book.findMany({
    where: { userId, bookId: { in: bookIds } },
    select: { bookId: true, bookName: true }
  });

  if (userBooks.length !== bookIds.length) {
    return error("部分账本不存在或无访问权限");
  }

  let whereClause = {
    bookId: { in: bookIds },
    userId: userId,
    flowType: "收入",
    industryType: industryType,
    transferId: null,
    NOT: {
      industryType: {
        in: ['借贷', '转账']
      }
    }
  };

  if (startDay && endDay) {
    whereClause.day = {
      gte: startDay,
      lte: endDay
    };
  }

  const total = await prisma.flow.count({
    where: whereClause
  });

  const totalInResult = await prisma.flow.aggregate({
    where: whereClause,
    _sum: {
      money: true
    }
  });

  const totalIn = totalInResult._sum.money || 0;

  const bookCountResult = await prisma.flow.groupBy({
    by: ['bookId'],
    where: whereClause,
    _count: {
      bookId: true
    }
  });

  const bookCount = bookCountResult.length;

  const flows = await prisma.flow.findMany({
    where: whereClause,
    include: {
      account: {
        select: {
          id: true,
          name: true
        }
      },
      book: {
        select: {
          bookId: true,
          bookName: true,
          color: true
        }
      }
    },
    orderBy: {
      day: 'desc'
    },
    skip: (pageNum - 1) * pageSize,
    take: pageSize
  });

  const totalPages = Math.ceil(total / pageSize);

  return success({
    data: flows,
    total: total,
    pages: totalPages,
    totalIn: totalIn,
    bookCount: bookCount,
    pageNum: pageNum,
    pageSize: pageSize
  });
});
