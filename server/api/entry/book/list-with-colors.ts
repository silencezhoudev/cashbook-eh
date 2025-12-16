import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/entry/book/list-with-colors:
 *   post:
 *     summary: 获取带颜色的账本列表
 *     tags: ["Book"]
 *     security:
 *       - Authorization: []
 *     responses:
 *       200:
 *         description: 账本列表获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: BookWithColor[]
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);

  const books = await prisma.book.findMany({
    where: { userId },
    select: {
      id: true,
      bookId: true,
      bookName: true,
      description: true,
      color: true,
      createDate: true
    },
    orderBy: { createDate: "desc" }
  });

  return success(books);
});
