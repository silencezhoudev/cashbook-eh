import { getUserId, success, error } from "~/server/utils/common";
import prisma from "~/lib/prisma";
import { AccountProfileService } from "~/server/utils/accountProfileService";

/**
 * 导入账本画像关键词
 * 输入：bookId + data.keywords（必填），可选 override、topN
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  if (!userId) {
    return error("请先登录");
  }

  try {
    const body = await readBody(event);
    const bookId = typeof body?.bookId === "string" ? body.bookId.trim() : "";
    const data = body?.data || {};
    const keywords: Record<string, number> =
      data.keywords || body?.keywords || {};
    const override =
      typeof body?.override === "boolean"
        ? body.override
        : typeof data?.override === "boolean"
          ? data.override
          : true;
    const topN =
      typeof body?.topN === "number"
        ? body.topN
        : typeof data?.topN === "number"
          ? data.topN
          : undefined;

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

    const profile = await AccountProfileService.importKeywords(
      userId,
      bookId,
      keywords,
      { override, topN }
    );

    return success({
      success: true,
      bookId: book.bookId,
      bookName: book.bookName,
      summary: profile.summary,
      totalFlows: profile.totalFlows,
      keywords: profile.merchantKeywords,
      message: `账本【${book.bookName}】关键词已导入`,
    });
  } catch (err: any) {
    console.error("[book/profile/import-keywords] 导入失败:", err);
    return error(err?.message || "导入失败，请检查文件内容");
  }
});


