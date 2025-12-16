import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";
import { AccountImportService } from "~/server/utils/accountImportService";

/**
 * @swagger
 * /api/entry/flow/smart-import-commit:
 *   post:
 *     summary: 提交智能导入的流水（第二步：将用户选择的流水导入数据库）
 *     tags: ["Flow"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             flows: Array<Flow> 要导入的流水列表
 *     responses:
 *       200:
 *         description: 导入成功
 *       400:
 *         description: 导入失败
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  if (!userId) {
    return error("请先登录");
  }

  try {
    const body = await readBody(event);
    const { bookId, flows } = body;

    if (!bookId) {
      return error("请选择账本");
    }

    if (!flows || !Array.isArray(flows) || flows.length === 0) {
      return error("请选择要导入的流水");
    }

    // 验证账本权限
    const books = await prisma.book.findMany({
      where: {
        userId,
      },
      select: {
        bookId: true,
        bookName: true,
      },
    });

    if (!books.some((b) => b.bookId === bookId)) {
      return error("账本不存在或无权限访问");
    }

    const bookIdSet = new Set(books.map((item) => item.bookId));
    const bookNameToId = new Map(books.map((item) => [item.bookName, item.bookId]));
    const bookIdToName = new Map(books.map((item) => [item.bookId, item.bookName]));

    // 准备导入数据（需要先处理账户）
    const processedFlows = await Promise.all(
      flows.map(async (flow: any) => {
        // 移除元数据字段
        const { _meta, bookId: flowBookId, ...flowData } = flow;
        const resolvedBookId =
          resolveBookIdFromFlow(flow, bookIdSet, bookNameToId) || bookId;
        const attributionName =
          flowData.attribution ||
          bookIdToName.get(resolvedBookId) ||
          "";
        
        // 处理账户：如果有 accountName，先创建或查找账户
        let accountId = flowData.accountId || null;
        if (!accountId && flowData.accountName) {
          try {
            accountId = await AccountImportService.handleAccountImport(
              prisma,
              {
                bookId: resolvedBookId,
                userId: userId,
                accountName: flowData.accountName,
              }
            );
          } catch (error) {
            console.error(`处理账户失败: ${flowData.accountName}`, error);
            // 账户处理失败不影响流水导入，继续使用 null
          }
        }
        
        return {
          userId,
          bookId: resolvedBookId,
          name: flowData.name || "",
          day: flowData.day || new Date().toISOString().split("T")[0],
          description: flowData.description || "",
          flowType: flowData.flowType || "支出",
          invoice: flowData.invoice ? String(flowData.invoice) : null,
          money: Number(flowData.money) || 0,
          payType: flowData.payType || "",
          industryType: flowData.industryType || "",
          attribution: attributionName,
          accountId: accountId,
          transferId: flowData.transferId || null,
        };
      })
    );

    // 批量导入
    const result = await prisma.flow.createMany({
      data: processedFlows,
      skipDuplicates: true, // 跳过重复记录
    });
    
    // 更新账户余额
    const accountIds = processedFlows
      .map(f => f.accountId)
      .filter((id): id is number => id !== null);
    
    if (accountIds.length > 0) {
      const uniqueAccountIds = Array.from(new Set(accountIds));
      await AccountImportService.updateMultipleAccountBalances(
        prisma,
        uniqueAccountIds
      );
    }

    return success({
      success: true,
      message: `成功导入 ${result.count} 条流水`,
      importedCount: result.count,
    });
  } catch (err: any) {
    console.error("提交导入失败:", err);
    return error(err?.message || "提交导入失败，请重试");
  }
});

function resolveBookIdFromFlow(
  flow: any,
  bookIdSet: Set<string>,
  bookNameToId: Map<string, string>
): string | undefined {
  const candidateIds: Array<string | undefined> = [
    flow?._meta?.appliedBookId,
    flow?.bookId,
  ];

  for (const candidate of candidateIds) {
    if (candidate && bookIdSet.has(candidate)) {
      return candidate;
    }
  }

  const attribution = flow?.attribution ? String(flow.attribution).trim() : "";
  if (attribution) {
    if (bookIdSet.has(attribution)) {
      return attribution;
    }
    const mapped = bookNameToId.get(attribution);
    if (mapped && bookIdSet.has(mapped)) {
      return mapped;
    }
  }

  return undefined;
}

