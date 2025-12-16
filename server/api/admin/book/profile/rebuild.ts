import prisma from "~/lib/prisma";
import { success, error } from "~/server/utils/common";
import { AccountProfileService } from "~/server/utils/accountProfileService";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const id = body?.id ? Number(body.id) : undefined;
    const bookId = body?.bookId;

    if (!id && !bookId) {
      return error("缺少账本标识");
    }

    const book = await prisma.book.findFirst({
      where: {
        ...(bookId ? { bookId } : {}),
        ...(id ? { id } : {}),
      },
    });

    if (!book) {
      return error("账本不存在或已删除");
    }

    const profile = await AccountProfileService.rebuild(
      book.userId,
      book.bookId
    );

    return success({
      success: true,
      message: `账本【${book.bookName}】画像已重建`,
      bookId: book.bookId,
      bookName: book.bookName,
      userId: book.userId,
      description: profile?.summary,
      profile,
    });
  } catch (err: any) {
    console.error("[admin/book/profile/rebuild] 重建失败:", err);
    return error(err?.message || "重建失败，请稍后重试");
  }
});

