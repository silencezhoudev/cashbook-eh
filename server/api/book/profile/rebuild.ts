import { getUserId, success, error } from "~/server/utils/common";
import { AccountProfileService } from "~/server/utils/accountProfileService";
import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/book/profile/rebuild:
 *   post:
 *     summary: 重建账本画像
 *     tags: ["Book"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID（可选，不传则重建所有账本）
 *     responses:
 *       200:
 *         description: 重建成功
 *       400:
 *         description: 重建失败
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  if (!userId) {
    return error("请先登录");
  }

  try {
    const body = await readBody(event);
    const { bookId } = body || {};

    // 获取要重建的账本列表
    const where: any = { userId };
    if (bookId) {
      where.bookId = bookId;
    }

    const books = await prisma.book.findMany({
      where,
      select: {
        bookId: true,
        bookName: true,
      },
    });

    if (books.length === 0) {
      return error(bookId ? "账本不存在或无权限访问" : "未找到可重建的账本");
    }

    // 重建每个账本的画像
    const results: Array<{ bookId: string; bookName: string; success: boolean; message?: string }> = [];

    for (const book of books) {
      try {
        const profile = await AccountProfileService.rebuild(
          userId,
          book.bookId
        );
        results.push({
          bookId: book.bookId,
          bookName: book.bookName,
          success: true,
          description: profile?.summary,
        });
      } catch (err: any) {
        console.error(`重建账本画像失败 [${book.bookId}]:`, err);
        results.push({
          bookId: book.bookId,
          bookName: book.bookName,
          success: false,
          message: err?.message || "重建失败",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    return success({
      success: true,
      message: `成功重建 ${successCount} 个账本画像${failCount > 0 ? `，失败 ${failCount} 个` : ""}`,
      results,
      successCount,
      failCount,
    });
  } catch (err: any) {
    console.error("[book/profile/rebuild] 重建失败:", err);
    return error(err?.message || "重建失败，请重试");
  }
});

