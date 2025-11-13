import prisma from "~/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * @swagger
 * /api/entry/flow/add:
 *   post:
 *     summary: 添加流水记录
 *     tags: ["Flow"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
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
 *         description: 流水记录添加成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: Flow 流水记录信息
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event); // 获取请求体

  if (!body.bookId) {
    return error("请先选择账本");
  }
  
  const userId = await getUserId(event);
  
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
    userId: userId,
    bookId: String(body.bookId),
    day: String(body.day || ""),
    flowType: String(body.flowType || ""), // 流水类型：收入、支出
    industryType: String(body.industryType || ""), // 行业分类 原 type（收入类型、支出类型）
    payType: String(body.payType || ""), // 支付方式
    name: String(body.name || ""),
    money: Number(body.money || ""),
    description: String(body.description || ""),
    invoice: String(body.invoice || ""), // 恢复小票字段
    attribution: String(body.attribution || ""),
    // 新增字段，保持可选
    accountId: body.accountId ? Number(body.accountId) : null,
    transferId: body.transferId ? Number(body.transferId) : null,
    eliminate: Number(body.eliminate || 0)
  };

  // 使用事务处理流水创建和余额更新
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 创建流水
    const createdFlow = await tx.flow.create({
      data: flow
    });
    
    // 如果指定了账户，更新账户余额
    if (body.accountId) {
      // 不计收支依然影响余额
      const balanceChange = flow.flowType === "收入" ? flow.money : -flow.money;
      
      await tx.account.update({
        where: { id: Number(body.accountId) },
        data: { balance: { increment: balanceChange } }
      });
    }
    
    return createdFlow;
  });

  return success(result);
});
