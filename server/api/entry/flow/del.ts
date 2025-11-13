import prisma from "~/lib/prisma";
import { BalanceService } from "~/server/utils/balanceService";

/**
 * @swagger
 * /api/entry/flow/del:
 *   post:
 *     summary: 删除流水记录
 *     tags: ["Flow"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             id: number 流水ID
 *             bookId: string 账本ID
 *     responses:
 *       200:
 *         description: 流水记录删除成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: Flow 删除的流水记录信息
 *       400:
 *         description: 删除失败
 *         content:
 *           application/json:
 *             schema:
 *               Error: {
 *                 message: "Not Find ID"
 *               }
 */
export default defineEventHandler(async (event) => {
  const { id, bookId } = await readBody(event); // 从请求体获取 ID

  if (!id || !bookId) {
    return error("Not Find ID");
  }

  // 使用事务处理删除和余额更新
  const result = await prisma.$transaction(async (tx) => {
    // 1. 先获取要删除的流水记录，用于后续更新账户余额
    const flowToDelete = await tx.flow.findUnique({
      where: { id, bookId },
    });

    if (!flowToDelete) {
      throw new Error("流水记录不存在");
    }

    // 若为转账关联流水，按整笔转账撤销
    if (flowToDelete.transferId) {
      const transfer = await tx.transfer.findFirst({
        where: { id: flowToDelete.transferId },
      });
      if (!transfer) {
        // 无 transfer，只做安全删除两条相关流水并重算两个账户余额
        const relatedFlows = await tx.flow.findMany({ where: { transferId: flowToDelete.transferId } });
        await tx.flow.deleteMany({ where: { transferId: flowToDelete.transferId } });
        const accountIds = Array.from(new Set(relatedFlows.map((f) => f.accountId).filter(Boolean))) as number[];
        for (const accId of accountIds) {
          await BalanceService.updateAccountBalance(accId, tx);
        }
        return { id, bookId } as any;
      }

      // 1) 删除两条流水
      await tx.flow.deleteMany({ where: { transferId: flowToDelete.transferId } });
      // 2) 回滚账户余额：from 加回，to 扣回
      await tx.account.update({
        where: { id: transfer.fromAccountId },
        data: { balance: { increment: transfer.amount } },
      });
      await tx.account.update({
        where: { id: transfer.toAccountId },
        data: { balance: { decrement: transfer.amount } },
      });
      // 3) 删除 transfer 记录
      await tx.transfer.delete({ where: { id: transfer.id } });
      return { id, bookId } as any;
    }

    // 非转账流水的普通删除
    const deleted = await tx.flow.delete({
      where: { id, bookId },
    });

    if (flowToDelete.accountId) {
      await BalanceService.updateAccountBalance(flowToDelete.accountId, tx);
      console.log(`已更新账户 ${flowToDelete.accountId} 的余额`);
    }

    return deleted;
  });

  return success(result);
});
