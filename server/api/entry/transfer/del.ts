import prisma from "~/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * @swagger
 * /api/entry/transfer/del:
 *   post:
 *     summary: 删除转账记录
 *     tags: ["Transfer"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             id: number 转账记录ID
 *             bookId: string 账本ID
 *     responses:
 *       200:
 *         description: 转账记录删除成功
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  if (!body.id) {
    return error("缺少转账记录ID");
  }
  
  const userId = await getUserId(event);
  
  // 检查转账记录是否存在且属于指定账本
  const transfer = await prisma.transfer.findFirst({
    where: {
      id: Number(body.id),
      userId: userId,
      // 确保转账属于指定账本
      flows: {
        some: {
          bookId: body.bookId
        }
      }
    },
    include: {
      flows: true
    }
  });
  
  if (!transfer) {
    return error("转账记录不存在");
  }
  
  console.log(`[删除转账] API调用: 转账ID=${body.id}, 账本ID=${body.bookId}, 关联流水数=${transfer.flows.length}`);

  // 使用事务撤销转账
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. 先查询所有关联的流水记录
    const relatedFlows = await tx.flow.findMany({
      where: { transferId: Number(body.id) }
    });

    console.log(`[删除转账] 查询到 ${relatedFlows.length} 条关联流水记录:`, 
      relatedFlows.map(f => ({ id: f.id, flowType: f.flowType, industryType: f.industryType, accountId: f.accountId })));

    // 2. 删除所有关联的流水记录
    const deleteResult = await tx.flow.deleteMany({
      where: { transferId: Number(body.id) }
    });

    console.log(`[删除转账] 实际删除了 ${deleteResult.count} 条流水记录`);

    // 验证删除是否完整
    if (deleteResult.count !== relatedFlows.length) {
      console.warn(`[删除转账] 警告: 期望删除 ${relatedFlows.length} 条流水，实际删除了 ${deleteResult.count} 条`);
    }
    
    // 3. 恢复账户余额
    await tx.account.update({
      where: { id: transfer.fromAccountId },
      data: { balance: { increment: transfer.amount } }
    });
    
    await tx.account.update({
      where: { id: transfer.toAccountId },
      data: { balance: { decrement: transfer.amount } }
    });

    console.log(`[删除转账] 已恢复账户余额: 转出账户 ${transfer.fromAccountId} +${transfer.amount}, 转入账户 ${transfer.toAccountId} -${transfer.amount}`);
    
    // 4. 删除转账记录
    await tx.transfer.delete({
      where: { id: Number(body.id) }
    });

    console.log(`[删除转账] 转账记录删除成功 ID=${body.id}`);

    // 5. 验证是否还有残留的流水记录
    const remainingFlows = await tx.flow.findMany({
      where: { transferId: Number(body.id) }
    });

    if (remainingFlows.length > 0) {
      console.error(`[删除转账] 错误: 删除后仍有 ${remainingFlows.length} 条残留流水记录:`, 
        remainingFlows.map(f => ({ id: f.id, flowType: f.flowType, industryType: f.industryType })));
      // 强制删除残留的流水记录
      await tx.flow.deleteMany({
        where: { transferId: Number(body.id) }
      });
      console.log(`[删除转账] 已强制删除残留的流水记录`);
    }
  });
  
  return success({ message: "转账记录删除成功" });
});
