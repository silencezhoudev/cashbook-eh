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
  
  // 使用事务撤销转账
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. 删除相关流水记录
    await tx.flow.deleteMany({
      where: { transferId: Number(body.id) }
    });
    
    // 2. 恢复账户余额
    await tx.account.update({
      where: { id: transfer.fromAccountId },
      data: { balance: { increment: transfer.amount } }
    });
    
    await tx.account.update({
      where: { id: transfer.toAccountId },
      data: { balance: { decrement: transfer.amount } }
    });
    
    // 3. 删除转账记录
    await tx.transfer.delete({
      where: { id: Number(body.id) }
    });
  });
  
  return success({ message: "转账记录删除成功" });
});
