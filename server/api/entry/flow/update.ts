import prisma from "~/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * @swagger
 * /api/entry/flow/update:
 *   post:
 *     summary: 更新流水记录
 *     tags: ["Flow"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             id: number 流水ID
 *             day: string 日期
 *             flowType: string 流水类型（收入、支出）
 *             industryType: string 行业分类
 *             payType: string 支付方式
 *             name: string 流水名称
 *             money: number 金额
 *             description: string 描述
 *             attribution: string 归属
 *             invoice: string 小票信息（可选）
 *             accountId: number 关联账户ID（可选）
 *             transferId: number 关联转账记录ID（可选）
 *     responses:
 *       200:
 *         description: 流水记录更新成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: Flow 更新后的流水记录
 *       400:
 *         description: 更新失败
 *         content:
 *           application/json:
 *             schema:
 *               Error: {
 *                 message: "Not Find ID"
 *               }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body.id || !body.bookId) {
    return error("Not Find ID");
  }
  
  const userId = await getUserId(event);
  
  // 获取原始流水记录
  const originalFlow = await prisma.flow.findFirst({
    where: { 
      id: Number(body.id), 
      bookId: body.bookId,
      userId: userId
    }
  });
  
  if (!originalFlow) {
    return error("流水记录不存在");
  }
  
  // 如果指定了账户，验证账户是否存在（移除 bookId 检查）
  if (body.accountId) {
    const account = await prisma.account.findFirst({
      where: {
        id: Number(body.accountId),
        userId: userId
      }
    });
    
    if (!account) {
      return error("指定的账户不存在或已禁用");
    }
  }
  
  const flow = {
    day: String(body.day || ""),
    flowType: String(body.flowType || ""), // 流水类型：收入、支出
    industryType: String(body.industryType || ""), // 行业分类 原 type（收入类型、支出类型）
    payType: String(body.payType || ""), // 支付方式
    money: Number(body.money || ""),
    name: String(body.name || ""),
    description: String(body.description || ""),
    attribution: String(body.attribution || ""),
    invoice: String(body.invoice || ""), // 恢复小票字段
    // 新增字段，保持可选
    accountId: body.accountId ? Number(body.accountId) : null,
    transferId: body.transferId ? Number(body.transferId) : null,
    eliminate: Number(body.eliminate || 0)
  };
  
  // 使用事务处理流水更新和余额调整
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 更新流水
    const updatedFlow = await tx.flow.update({
      where: { id: Number(body.id), bookId: body.bookId },
      data: flow,
    });
    
    // 处理账户余额变化
    if (originalFlow.accountId || body.accountId) {
      // 如果原来有账户，先恢复原账户余额
      if (originalFlow.accountId) {
        const originalBalanceChange = originalFlow.flowType === "收入" ? 
          -(originalFlow.money || 0) : (originalFlow.money || 0);
        
        await tx.account.update({
          where: { id: originalFlow.accountId },
          data: { balance: { increment: originalBalanceChange } }
        });
      }
      
      // 如果新指定了账户，更新新账户余额
      if (body.accountId) {
        // 不计收支依然影响余额
        const newBalanceChange = flow.flowType === "收入" ? 
          flow.money : -flow.money;
        
        await tx.account.update({
          where: { id: Number(body.accountId) },
          data: { balance: { increment: newBalanceChange } }
        });
      }
    }
    
    return updatedFlow;
  });
  
  return success(result);
});
