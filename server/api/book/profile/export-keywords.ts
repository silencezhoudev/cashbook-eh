import { getUserId, success, error } from "~/server/utils/common";
import prisma from "~/lib/prisma";
import { AccountProfileService } from "~/server/utils/accountProfileService";

/**
 * 导出账本画像关键词
 * 用途：将老账本的关键词迁移到新账本，降低冷启动成本
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  if (!userId) {
    return error("请先登录");
  }

  try {
    const body = await readBody(event);
    const bookId = typeof body?.bookId === "string" ? body.bookId.trim() : "";

    if (!bookId) {
      return error("缺少账本ID");
    }

    const book = await prisma.book.findFirst({
      where: { userId, bookId },
      select: { bookId: true, bookName: true },
    });

    if (!book) {
      return error("账本不存在或无权限访问");
    }

    const exportData = await AccountProfileService.exportKeywords(
      userId,
      bookId
    );

    if (!exportData) {
      return error("该账本暂无画像数据可导出");
    }

    return success({
      ...exportData,
      bookName: book.bookName,
    });
  } catch (err: any) {
    console.error("[book/profile/export-keywords] 导出失败:", err);
    return error(err?.message || "导出失败，请重试");
  }
});


