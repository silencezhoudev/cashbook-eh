import prisma from "~/lib/prisma";
import type { Prisma } from "@prisma/client";
import { LoanService } from "~/server/utils/loanService";

/**
 * @swagger
 * /api/entry/transfer/add:
 *   post:
 *     summary: 执行转账操作
 *     tags: ["Transfer"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             fromAccountId: number 转出账户ID
 *             toAccountId: number 转入账户ID
 *             amount: number 转账金额
 *             day: string 转账日期
 *             name: string 转账说明
 *             description: string 备注
 *     responses:
 *       200:
 *         description: 转账成功
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  if (!body.fromAccountId || !body.toAccountId || !body.amount) {
    return error("请填写必要信息");
  }
  
  if (body.fromAccountId === body.toAccountId) {
    return error("转出账户和转入账户不能相同");
  }
  
  if (Number(body.amount) <= 0) {
    return error("转账金额必须大于0");
  }
  
  const userId = await getUserId(event);
  
  // 验证账户是否存在且属于当前用户
  const [fromAccount, toAccount] = await Promise.all([
    prisma.account.findFirst({
      where: {
        id: Number(body.fromAccountId),
        userId: userId
      }
    }),
    prisma.account.findFirst({
      where: {
        id: Number(body.toAccountId),
        userId: userId
      }
    })
  ]);
  
  if (!fromAccount || !toAccount) {
    return error("账户不存在或已禁用");
  }
  
  // 使用事务处理转账
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. 创建转账记录
    const transfer = await tx.transfer.create({
      data: {
        userId: userId,
        fromAccountId: Number(body.fromAccountId),
        toAccountId: Number(body.toAccountId),
        amount: Number(body.amount),
        day: body.day || new Date().toISOString().split("T")[0],
        name: body.name || (body.flowType === '借贷' ? '借贷' : '账户转账'),
        description: body.description
      }
    });
    
    // 2. 创建转出流水
    const outFlow = await tx.flow.create({
      data: {
        userId: userId,
        bookId: body.bookId,
        day: transfer.day,
        flowType: "转账",
        industryType: "转账",
        payType: "转账",
        money: Number(body.amount),
        name: `从${fromAccount.name}转账到${toAccount.name}`,
        description: body.description,
        attribution: body.flowType === '借贷' ? '借贷' : '转账',
        accountId: Number(body.fromAccountId),
        transferId: transfer.id
      }
    });
    
    // 3. 创建转入流水
    const inFlow = await tx.flow.create({
      data: {
        userId: userId,
        bookId: body.bookId,
        day: transfer.day,
        flowType: "转账",
        industryType: "转账",
        payType: "转账",
        money: Number(body.amount),
        name: `从${fromAccount.name}转账到${toAccount.name}`,
        description: body.description,
        attribution: body.flowType === '借贷' ? '借贷' : '转账',
        accountId: Number(body.toAccountId),
        transferId: transfer.id
      }
    });
    
    // 4. 更新账户余额
    await tx.account.update({
      where: { id: Number(body.fromAccountId) },
      data: { balance: { decrement: Number(body.amount) } }
    });
    
    await tx.account.update({
      where: { id: Number(body.toAccountId) },
      data: { balance: { increment: Number(body.amount) } }
    });
    
    return { transfer, outFlow, inFlow };
  });
  
  return success(result);
});
