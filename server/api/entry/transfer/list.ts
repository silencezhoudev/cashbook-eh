import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/entry/transfer/list:
 *   post:
 *     summary: 获取转账记录列表
 *     tags: ["Transfer"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             pageNum: number 页码（可选，默认1）
 *             pageSize: number 每页数量（可选，默认20）
 *             startDay: string 开始日期（可选）
 *             endDay: string 结束日期（可选）
 *     responses:
 *       200:
 *         description: 转账记录列表获取成功
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  const userId = await getUserId(event);
  
  const where: any = {
    userId: userId
  };
  
  // 日期范围过滤
  if (body.startDay && body.endDay) {
    where.day = {
      gte: body.startDay,
      lte: body.endDay
    };
  } else if (body.startDay) {
    where.day = { gte: body.startDay };
  } else if (body.endDay) {
    where.day = { lte: body.endDay };
  }
  
  // 分页参数
  const pageNum = Number(body.pageNum) || 1;
  const pageSize = Number(body.pageSize) || 100;
  const skip = (pageNum - 1) * pageSize;
  
  // 获取转账记录和总数
  const [transfers, total] = await Promise.all([
    prisma.transfer.findMany({
      where,
      include: {
        fromAccount: {
          select: { id: true, name: true, type: true }
        },
        toAccount: {
          select: { id: true, name: true, type: true }
        }
      },
      orderBy: { createDate: "desc" },
      skip,
      take: pageSize
    }),
    prisma.transfer.count({ where })
  ]);
  
  const totalPages = Math.ceil(total / pageSize);
  
  return success({
    data: transfers,
    total,
    pageNum,
    pageSize,
    totalPages
  });
});
