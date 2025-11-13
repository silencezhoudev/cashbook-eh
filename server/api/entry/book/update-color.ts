import prisma from "~/lib/prisma";
import { validateBookColor } from "~/server/utils/bookValidation";

/**
 * @swagger
 * /api/entry/book/update-color:
 *   post:
 *     summary: 更新账本颜色
 *     tags: ["Book"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             color: string 颜色值（#RRGGBB格式）
 *     responses:
 *       200:
 *         description: 颜色更新成功
 */
export default defineEventHandler(async (event) => {
  const { bookId, color } = await readBody(event);
  const userId = await getUserId(event);

  // 参数验证
  if (!bookId) {
    return error("账本ID不能为空");
  }

  if (!validateBookColor(color)) {
    return error("颜色格式不正确，请使用 #RRGGBB 格式");
  }

  // 检查账本是否存在
  const book = await prisma.book.findFirst({
    where: { bookId, userId }
  });

  if (!book) {
    return error("账本不存在或无访问权限");
  }

  // 更新颜色
  await prisma.book.update({
    where: { id: book.id },
    data: { color }
  });

  return success({ message: "颜色更新成功" });
});
