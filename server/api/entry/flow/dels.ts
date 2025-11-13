import prisma from "~/lib/prisma";
import { BalanceService } from "~/server/utils/balanceService";

/**
 * @swagger
 * /api/entry/flow/dels:
 *   post:
 *     summary: 批量删除流水记录
 *     tags: ["Flow"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             ids: number[] 流水ID数组
 *             bookId: string 账本ID
 *     responses:
 *       200:
 *         description: 批量删除成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: number 删除的记录数量
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
  try {
    const { ids, bookId } = await readBody(event); // 从请求体获取 ID
    const userId = await getUserId(event);

    if (!ids || !bookId) {
      return error("Not Find ID");
    }

    if (!userId) {
      return error("Unauthorized");
    }

    // 验证用户是否有权限删除该账本的流水
    const book = await prisma.book.findFirst({
      where: {
        bookId: String(bookId),
        userId: userId,
      },
    });

    if (!book) {
      return error("Book not found or no permission");
    }

    // 将字符串ID转换为整数ID
    console.log('原始IDs:', ids);
    const numericIds = ids.map((id: any) => {
      console.log('处理ID:', id, '类型:', typeof id);
      // 如果ID格式是 "flow_536"，提取数字部分
      if (typeof id === 'string' && id.startsWith('flow_')) {
        const numericId = parseInt(id.replace('flow_', ''), 10);
        console.log('提取流水数字ID:', numericId);
        return { id: numericId, type: 'flow' };
      }
      // 如果ID格式是 "transfer_7"，提取数字部分
      if (typeof id === 'string' && id.startsWith('transfer_')) {
        const numericId = parseInt(id.replace('transfer_', ''), 10);
        console.log('提取转账数字ID:', numericId);
        return { id: numericId, type: 'transfer' };
      }
      // 如果已经是数字字符串，直接转换
      const numericId = parseInt(String(id), 10);
      console.log('转换数字ID:', numericId);
      return { id: numericId, type: 'flow' }; // 默认为流水类型
    }).filter(item => !isNaN(item.id) && item.id > 0); // 过滤掉无效的ID，确保是正整数

    console.log('最终数字IDs:', numericIds);

    if (numericIds.length === 0) {
      console.error('没有有效的数字ID，原始IDs:', ids);
      return error("Invalid flow IDs");
    }

    // 分别处理流水和转账记录
    const flowIds = numericIds.filter(item => item.type === 'flow').map(item => item.id);
    const transferIds = numericIds.filter(item => item.type === 'transfer').map(item => item.id);

    let totalDeleted = 0;
    const affectedAccountIds = new Set<number>();

    // 使用事务处理删除和余额更新
    const result = await prisma.$transaction(async (tx) => {
      // 删除流水记录
      if (flowIds.length > 0) {
        console.log('删除流水记录，IDs:', flowIds);
        
        // 先获取要删除的流水记录，用于收集受影响的账户ID
        const flowsToDelete = await tx.flow.findMany({
          where: {
            id: {
              in: flowIds,
            },
            bookId: String(bookId),
            userId: userId,
          },
          select: { id: true, accountId: true }
        });

        // 收集受影响的账户ID
        flowsToDelete.forEach(flow => {
          if (flow.accountId) {
            affectedAccountIds.add(flow.accountId);
          }
        });

        const deletedFlows = await tx.flow.deleteMany({
          where: {
            id: {
              in: flowIds,
            },
            bookId: String(bookId),
            userId: userId,
          },
        });
        totalDeleted += deletedFlows.count;
        console.log('删除流水记录数量:', deletedFlows.count);
      }

      // 删除转账记录
      if (transferIds.length > 0) {
        console.log('删除转账记录，IDs:', transferIds);
        
        // 先获取要删除的转账记录，用于收集受影响的账户ID
        const transfersToDelete = await tx.transfer.findMany({
          where: {
            id: {
              in: transferIds,
            },
            userId: userId,
          },
          select: { id: true, fromAccountId: true, toAccountId: true }
        });

        // 收集受影响的账户ID
        transfersToDelete.forEach(transfer => {
          affectedAccountIds.add(transfer.fromAccountId);
          affectedAccountIds.add(transfer.toAccountId);
        });

        const deletedTransfers = await tx.transfer.deleteMany({
          where: {
            id: {
              in: transferIds,
            },
            userId: userId,
          },
        });
        totalDeleted += deletedTransfers.count;
        console.log('删除转账记录数量:', deletedTransfers.count);
      }

      // 更新所有受影响账户的余额
      for (const accountId of affectedAccountIds) {
        await BalanceService.updateAccountBalance(accountId, tx);
        console.log(`已更新账户 ${accountId} 的余额`);
      }

      return { count: totalDeleted };
    });
    
    return success(result);
  } catch (err) {
    console.error("Delete flows error:", err);
    return error("Delete failed: " + (err as Error).message);
  }
});
