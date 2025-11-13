import prisma from "~/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/transfer/update:
 *   post:
 *     summary: 更新转账记录
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
 *             fromAccountId: number 转出账户ID（可选）
 *             toAccountId: number 转入账户ID（可选）
 *             amount: number 转账金额（可选）
 *             day: string 转账日期（可选）
 *             name: string 转账说明（可选）
 *             description: string 备注（可选）
 *     responses:
 *       200:
 *         description: 转账记录更新成功
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.id || !body.bookId) {
    return error("缺少必要参数");
  }

  const userId = await getUserId(event);

  // 读取原始转账与关联流水，校验归属账本
  const original = await prisma.transfer.findFirst({
    where: {
      id: Number(body.id),
      userId: userId,
      flows: {
        some: { bookId: String(body.bookId) }
      }
    },
    include: {
      flows: true,
      fromAccount: true,
      toAccount: true
    }
  });

  if (!original) {
    return error("转账记录不存在");
  }

  const oldFromId = original.fromAccountId;
  const oldToId = original.toAccountId;
  const oldAmount = original.amount;
  const oldDay = original.day;
  const oldName = original.name || "";
  const oldDesc = original.description || "";

  const newFromId = body.fromAccountId ? Number(body.fromAccountId) : oldFromId;
  const newToId = body.toAccountId ? Number(body.toAccountId) : oldToId;
  const newAmount = body.amount ? Number(body.amount) : oldAmount;
  const newDay = body.day ? String(body.day) : oldDay;
  const newName = body.name ?? oldName;
  const newDesc = body.description ?? oldDesc;

  if (newAmount <= 0) {
    return error("转账金额必须大于0");
  }

  if (newFromId === newToId) {
    return error("转出账户和转入账户不能相同");
  }

  // 校验账户有效性（如有变更或用于名称展示）
  const [fromAccount, toAccount] = await Promise.all([
    prisma.account.findFirst({ where: { id: newFromId, userId } }),
    prisma.account.findFirst({ where: { id: newToId, userId } })
  ]);

  if (!fromAccount || !toAccount) {
    return error("账户不存在或已禁用");
  }

  // 编辑转账时不校验余额充足性，允许透支或临时不一致，由后续校验工具处理

  // 计算两条流水（支出/收入）
  const outFlow = original.flows.find((f: any) => f.flowType === "支出");
  const inFlow = original.flows.find((f: any) => f.flowType === "收入");

  if (!outFlow || !inFlow) {
    return error("转账关联流水异常");
  }

  const bookId = String(body.bookId);

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1) 删除旧的两条流水
    await tx.flow.deleteMany({ where: { transferId: original.id } });

    // 2) 回滚旧余额影响
    await tx.account.update({ where: { id: oldFromId }, data: { balance: { increment: oldAmount } } });
    await tx.account.update({ where: { id: oldToId }, data: { balance: { decrement: oldAmount } } });

    // 3) 删除旧的 transfer
    await tx.transfer.delete({ where: { id: original.id } });

    // 4) 创建新的 transfer
    const createdTransfer = await tx.transfer.create({
      data: {
        userId,
        fromAccountId: newFromId,
        toAccountId: newToId,
        amount: newAmount,
        day: newDay,
        name: newName || "账户转账",
        description: newDesc || undefined,
      }
    });

    // 5) 创建新的两条流水（保持账本不变）
    const outName = `转出到${toAccount.name}`;
    const inName = `从${fromAccount.name}转入`;

    await tx.flow.create({
      data: {
        userId,
        bookId,
        day: newDay,
        flowType: "支出",
        industryType: "转账",
        payType: "转账",
        money: newAmount,
        name: outName,
        description: newDesc || undefined,
        attribution: "转账",
        accountId: newFromId,
        transferId: createdTransfer.id,
      }
    });

    await tx.flow.create({
      data: {
        userId,
        bookId,
        day: newDay,
        flowType: "收入",
        industryType: "转账",
        payType: "转账",
        money: newAmount,
        name: inName,
        description: newDesc || undefined,
        attribution: "转账",
        accountId: newToId,
        transferId: createdTransfer.id,
      }
    });

    // 6) 应用新余额影响
    await tx.account.update({ where: { id: newFromId }, data: { balance: { decrement: newAmount } } });
    await tx.account.update({ where: { id: newToId }, data: { balance: { increment: newAmount } } });

    return { transfer: createdTransfer };
  });

  return success(result);
});


