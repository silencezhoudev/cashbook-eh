import prisma from "~/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getUserId, success, error } from "~/server/utils/common";
import { BalanceService } from "~/server/utils/balanceService";

/**
 * @swagger
 * /api/entry/maintenance/cleanup-orphans:
 *   post:
 *     summary: 清理用户无主（孤儿）的流水/预算/固定流水/类型映射/应收款和无关联转账
 *     tags: ["Maintenance"]
 *     security:
 *       - Authorization: []
 *     responses:
 *       200:
 *         description: 清理完成
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const books = await tx.book.findMany({
        where: { userId },
        select: { bookId: true }
      });
      const existingBookIds = books.map((b: { bookId: string }) => b.bookId);

      const affectedAccountIds = new Set<number>();
      const affectedTransferIds = new Set<number>();

      const flowWhere: any = existingBookIds.length > 0
        ? { userId, bookId: { notIn: existingBookIds } }
        : { userId };

      const fixedFlowWhere: any = existingBookIds.length > 0
        ? { userId, bookId: { notIn: existingBookIds } }
        : { userId };

      const budgetWhere: any = existingBookIds.length > 0
        ? { userId, bookId: { notIn: existingBookIds } }
        : { userId };

      const typeRelationWhere: any = existingBookIds.length > 0
        ? { userId, bookId: { notIn: existingBookIds } }
        : { userId };

      const receivableWhere: any = existingBookIds.length > 0
        ? { userId, bookId: { notIn: existingBookIds } }
        : { userId };

      const flowsToDelete = await tx.flow.findMany({
        where: flowWhere,
        select: { accountId: true, transferId: true }
      });
      for (const f of flowsToDelete) {
        if (f.accountId) affectedAccountIds.add(f.accountId);
        if (f.transferId) affectedTransferIds.add(f.transferId);
      }

      const fixedFlowsToDelete = await tx.fixedFlow.findMany({
        where: fixedFlowWhere,
        select: { accountId: true }
      });
      for (const ff of fixedFlowsToDelete) {
        if (ff.accountId) affectedAccountIds.add(ff.accountId);
      }

      const deletedFlows = await tx.flow.deleteMany({ where: flowWhere });
      const deletedFixed = await tx.fixedFlow.deleteMany({ where: fixedFlowWhere });
      const deletedBudgets = await tx.budget.deleteMany({ where: budgetWhere });
      const deletedTypeRelations = await tx.typeRelation.deleteMany({ where: typeRelationWhere });
      const deletedReceivables = await tx.receivable.deleteMany({ where: receivableWhere });

      const deletedOrphanTransfers = await tx.transfer.deleteMany({
        where: {
          userId,
          flows: { none: {} }
        }
      });

      let updatedAccounts = 0;
      for (const accountId of affectedAccountIds) {
        try {
          await BalanceService.updateAccountBalance(accountId, tx);
          updatedAccounts++;
        } catch {
          // 跳过单个失败，继续
        }
      }

      return {
        bookCount: existingBookIds.length,
        deleted: {
          flows: deletedFlows.count,
          fixedFlows: deletedFixed.count,
          budgets: deletedBudgets.count,
          typeRelations: deletedTypeRelations.count,
          receivables: deletedReceivables.count,
          orphanTransfers: deletedOrphanTransfers.count,
          updatedAccounts
        }
      };
    });

    return success(result);
  } catch (e: any) {
    return error(e?.message || "清理失败");
  }
});


