import prisma from "~/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getUserId, success, error } from "~/server/utils/common";
import { BalanceService } from "~/server/utils/balanceService";

/**
 * @swagger
 * /api/entry/maintenance/recalc-balances:
 *   post:
 *     summary: 重新计算当前用户的账户余额
 *     tags: ["Maintenance"]
 *     security:
 *       - Authorization: []
 *     responses:
 *       200:
 *         description: 重算完成
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const accounts = await tx.account.findMany({
        where: { userId }
      });

      let updated = 0;
      for (const account of accounts) {
        try {
          await BalanceService.updateAccountBalance(account.id, tx);
          updated++;
        } catch {
          // 跳过单个失败，继续
        }
      }

      return { updated, total: accounts.length };
    });

    return success(result);
  } catch (e: any) {
    return error(e?.message || "余额重算失败");
  }
});


