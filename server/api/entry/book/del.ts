import prisma from "~/lib/prisma";
import { BalanceService } from "~/server/utils/balanceService";

/**
 * @swagger
 * /api/entry/book/del:
 *   post:
 *     summary: 删除账本
 *     tags: ["Book"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             id: number 账本ID
 *     responses:
 *       200:
 *         description: 账本删除成功
 *         content:
 *           application/json:
 *             schema:
 *               Result: {
 *                 d: Book 删除的账本信息
 *               }
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
  const { id } = await readBody(event); // 从请求体获取 ID
  const userId = await getUserId(event);

  if (!id) {
    return error("Not Find ID");
  }

  // 先获取账本信息
  const book = await prisma.book.findFirst({
    where: { id, userId },
  });

  if (!book) {
    return error("Book not found");
  }

  const bookId = book.bookId;

  // 使用事务删除所有相关数据
  const result = await prisma.$transaction(async (tx: any) => {
    console.log(`开始删除账本 ${bookId} (ID: ${id})，用户ID: ${userId}`);
    const startTime = Date.now();
    
    // 1. 获取所有受影响的账户ID和转账ID（用于后续更新余额和删除转账）
    const affectedAccountIds = new Set<number>();
    const transferIds = new Set<number>();
    
    // 从流水记录中收集账户ID和转账ID
    const flows = await tx.flow.findMany({
      where: { bookId, userId },
      select: { accountId: true, transferId: true }
    });
    
    flows.forEach((flow: any) => {
      if (flow.accountId) {
        affectedAccountIds.add(flow.accountId);
      }
      if (flow.transferId) {
        transferIds.add(flow.transferId);
      }
    });

    // 从固定流水中收集账户ID
    const fixedFlows = await tx.fixedFlow.findMany({
      where: { bookId, userId },
      select: { accountId: true }
    });
    
    fixedFlows.forEach((fixedFlow: any) => {
      if (fixedFlow.accountId) {
        affectedAccountIds.add(fixedFlow.accountId);
      }
    });

    // 从转账记录中收集账户ID
    if (transferIds.size > 0) {
      const transfers = await tx.transfer.findMany({
        where: { 
          id: { in: Array.from(transferIds) },
          userId 
        },
        select: { fromAccountId: true, toAccountId: true }
      });
      
      transfers.forEach((transfer: any) => {
        affectedAccountIds.add(transfer.fromAccountId);
        affectedAccountIds.add(transfer.toAccountId);
      });
    }

    console.log(`收集到 ${affectedAccountIds.size} 个受影响账户，${transferIds.size} 个转账记录`);

    // 1.5. 在删除数据前，先计算每个账户在该账本中的余额影响
    const accountBalanceImpacts = new Map<number, number>();
    for (const accountId of affectedAccountIds) {
      try {
        const impact = await BalanceService.calculateAccountBalanceInBook(accountId, bookId, userId, tx);
        accountBalanceImpacts.set(accountId, impact);
        console.log(`账户 ${accountId} 在该账本中的余额影响: ${impact}`);
      } catch (error) {
        console.error(`计算账户 ${accountId} 余额影响失败:`, error);
        accountBalanceImpacts.set(accountId, 0);
      }
    }

    // 2. 删除所有相关数据（按依赖关系顺序）
    
    // 2.1 删除流水记录（包含关联转账的流水）
    const deletedFlows = await tx.flow.deleteMany({
      where: { bookId, userId }
    });
    console.log(`删除流水记录: ${deletedFlows.count} 条`);

    // 2.2 删除转账记录（在删除流水后删除，避免外键约束问题）
    let deletedTransfers = 0;
    if (transferIds.size > 0) {
      const transferResult = await tx.transfer.deleteMany({
        where: { 
          id: { in: Array.from(transferIds) },
          userId 
        }
      });
      deletedTransfers = transferResult.count;
      console.log(`删除转账记录: ${deletedTransfers} 条`);
    }

    // 2.3 删除固定流水记录
    const deletedFixedFlows = await tx.fixedFlow.deleteMany({
      where: { bookId, userId }
    });
    console.log(`删除固定流水记录: ${deletedFixedFlows.count} 条`);

    // 2.4 删除预算记录
    const deletedBudgets = await tx.budget.deleteMany({
      where: { bookId, userId }
    });
    console.log(`删除预算记录: ${deletedBudgets.count} 条`);

    // 2.5 删除类型关系记录
    const deletedTypeRelations = await tx.typeRelation.deleteMany({
      where: { bookId, userId }
    });
    console.log(`删除类型关系记录: ${deletedTypeRelations.count} 条`);

    // 2.6 删除应收款记录
    const deletedReceivables = await tx.receivable.deleteMany({
      where: { bookId, userId }
    });
    console.log(`删除应收款记录: ${deletedReceivables.count} 条`);

    // 3. 删除账本
    const deletedBook = await tx.book.delete({
      where: { id, userId }
    });
    console.log(`删除账本: ${deletedBook.bookName}`);

    // 4. 恢复所有受影响账户的余额（使用预先计算的余额影响）
    let updatedAccounts = 0;
    for (const accountId of affectedAccountIds) {
      try {
        const impact = accountBalanceImpacts.get(accountId) || 0;
        const account = await tx.account.findUnique({
          where: { id: accountId }
        });
        
        if (account) {
          const newBalance = account.balance - impact;
          await tx.account.update({
            where: { id: accountId },
            data: { balance: newBalance }
          });
          console.log(`账户 ${accountId} 余额恢复: ${account.balance} - ${impact} = ${newBalance}`);
          updatedAccounts++;
        }
      } catch (error) {
        console.error(`恢复账户 ${accountId} 余额失败:`, error);
        // 继续处理其他账户，不中断整个流程
      }
    }
    console.log(`恢复账户余额: ${updatedAccounts} 个账户`);

    const endTime = Date.now();
    console.log(`账本删除完成，耗时: ${endTime - startTime}ms`);

    return {
      ...deletedBook,
      deletedCounts: {
        flows: deletedFlows.count,
        transfers: deletedTransfers,
        fixedFlows: deletedFixedFlows.count,
        budgets: deletedBudgets.count,
        typeRelations: deletedTypeRelations.count,
        receivables: deletedReceivables.count,
        updatedAccounts
      }
    };
  });

  return success(result);
});
