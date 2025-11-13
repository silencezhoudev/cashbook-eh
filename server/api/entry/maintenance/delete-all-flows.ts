import prisma from "~/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getUserId, success, error } from "~/server/utils/common";
import { BalanceService } from "~/server/utils/balanceService";

/**
 * @swagger
 * /api/entry/maintenance/delete-all-flows:
 *   post:
 *     summary: 删除当前用户所有流水及相关数据并重置账户余额
 *     tags: ["Maintenance"]
 *     security:
 *       - Authorization: []
 *     responses:
 *       200:
 *         description: 删除完成
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const affectedAccountIds = new Set<number>();
      const affectedTransferIds = new Set<number>();

      const flowsToDelete = await tx.flow.findMany({
        where: { userId },
        select: { accountId: true, transferId: true }
      });
      for (const f of flowsToDelete) {
        if (f.accountId) affectedAccountIds.add(f.accountId);
        if (f.transferId) affectedTransferIds.add(f.transferId);
      }

      const fixedFlowsToDelete = await tx.fixedFlow.findMany({
        where: { userId },
        select: { accountId: true }
      });
      for (const ff of fixedFlowsToDelete) {
        if (ff.accountId) affectedAccountIds.add(ff.accountId);
      }

      const deletedFlows = await tx.flow.deleteMany({ where: { userId } });
      const deletedFixed = await tx.fixedFlow.deleteMany({ where: { userId } });
      const deletedBudgets = await tx.budget.deleteMany({ where: { userId } });
      const deletedTypeRelations = await tx.typeRelation.deleteMany({ where: { userId } });
      const deletedReceivables = await tx.receivable.deleteMany({ where: { userId } });

      const deletedOrphanTransfers = await tx.transfer.deleteMany({
        where: { userId, flows: { none: {} } }
      });

      const resetAccounts = await tx.account.updateMany({
        where: { userId },
        data: { balance: 0 }
      });

      let updatedAccounts = 0;
      for (const accountId of affectedAccountIds) {
        try {
          await BalanceService.updateAccountBalance(accountId, tx);
          updatedAccounts++;
        } catch {
          // ignore single account failure
        }
      }

      return {
        deleted: {
          flows: deletedFlows.count,
          fixedFlows: deletedFixed.count,
          budgets: deletedBudgets.count,
          typeRelations: deletedTypeRelations.count,
          receivables: deletedReceivables.count,
          orphanTransfers: deletedOrphanTransfers.count,
          resetAccounts: resetAccounts.count,
          updatedAccounts
        }
      };
    });

    return success(result);
  } catch (e: any) {
    return error(e?.message || "删除失败");
  }
});


