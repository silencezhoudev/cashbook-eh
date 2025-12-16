import * as fs from "fs";
import * as path from "path";
import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/book/get-book-details:
 *   post:
 *     summary: 获取账本的详细信息（包括账本信息、交易类型、收支类型），支持单个或多个账本查询
 *     tags: ["Book"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 单个账本ID（可选，与bookIds二选一）
 *             bookIds: string[] 多个账本ID数组（可选，与bookId二选一）
 *             如果不传任何参数，则返回用户所有账本的信息
 *     responses:
 *       200:
 *         description: 账本详细信息获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: [{
 *                   bookId: string 账本ID,
 *                   bookName: string 账本名称,
 *                   description: string 账本描述,
 *                   flowTypes: string[] 所有交易类型,
 *                   industryTypes: string[] 所有收支类型
 *                 }]
 *       400:
 *         description: 获取失败
 *         content:
 *           application/json:
 *             schema:
 *               Error: {
 *                 message: "请先创建账本"
 *               }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const userId = await getUserId(event);
  
  // 确定要查询的账本ID列表
  let bookIds: string[] = [];
  
  if (body?.bookIds && Array.isArray(body.bookIds) && body.bookIds.length > 0) {
    // 如果传入了bookIds数组，使用它
    bookIds = body.bookIds;
  } else if (body?.bookId) {
    // 如果传入了单个bookId，转换为数组
    bookIds = [body.bookId];
  } else {
    // 如果没有传入任何参数，获取用户的所有账本
    const userBooks = await prisma.book.findMany({
      where: { userId },
      select: { bookId: true },
      orderBy: { createDate: "desc" },
    });
    
    if (userBooks.length === 0) {
      return error("请先创建账本");
    }
    
    bookIds = userBooks.map(book => book.bookId);
  }

  // 验证所有账本是否存在且属于当前用户
  const books = await prisma.book.findMany({
    where: {
      bookId: { in: bookIds },
      userId,
    },
    select: {
      bookId: true,
      bookName: true,
      description: true,
    } as any,
  });

  if (books.length === 0) {
    return error("账本不存在或无权限访问");
  }

  // 获取实际查询到的账本ID列表（过滤掉无权限的）
  const validBookIds = books.map(book => book.bookId);

  // 为每个账本查询详细信息
  const results = await Promise.all(
    books.map(async (book) => {
      // 查询该账本的所有不同的交易类型（flowType）
      const flowWhere: any = {
        bookId: book.bookId,
      };
      const flowTypesResult = await prisma.flow.findMany({
        where: flowWhere,
        distinct: ["flowType"],
        select: {
          flowType: true,
        },
        orderBy: {
          flowType: "asc",
        },
      });

      // 查询该账本的所有不同的收支类型（industryType）
      const industryWhere: any = {
        bookId: book.bookId,
        industryType: {
          not: null,
        },
      };
      const industryTypesResult = await prisma.flow.findMany({
        where: industryWhere,
        distinct: ["industryType"],
        select: {
          industryType: true,
        },
        orderBy: {
          industryType: "asc",
        },
      });

      // 提取flowType和industryType的值，过滤掉null值
      const flowTypes = flowTypesResult
        .map((item) => item.flowType)
        .filter((type): type is string => type !== null && type !== undefined);

      const industryTypes = industryTypesResult
        .map((item) => item.industryType)
        .filter((type): type is string => type !== null && type !== undefined);

      return {
        bookId: book.bookId,
        bookName: book.bookName,
        description: (book as any).description || "",
        flowTypes,
        industryTypes,
      };
    })
  );

  // 生成临时JSON文件用于调试
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const bookIdsStr = validBookIds.join("-").substring(0, 50); // 限制文件名长度
    const fileName = `book-details-${bookIdsStr}-${timestamp}.json`;
    const filePath = path.join(process.cwd(), fileName);
    
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(results, null, 2),
      "utf-8"
    );
    
    console.log(`临时JSON文件已生成: ${filePath}`);
  } catch (fileError) {
    console.error("生成临时JSON文件失败:", fileError);
    // 文件生成失败不影响接口返回
  }

  return success(results);
});

