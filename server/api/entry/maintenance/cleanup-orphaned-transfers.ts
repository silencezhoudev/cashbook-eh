import prisma from "~/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * 清理数据库中的孤立转账记录和流水记录
 * 1. 删除没有关联flows的transfer记录（孤立transfer）
 * 2. 清理transferId指向不存在transfer的flow记录（将transferId设为null）
 * 3. 清理重复的flow记录（保留第一条，删除其他）
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const userId = await getUserId(event);

  // 确认参数
  const confirm = body.confirm === true;
  const cleanupOrphanedTransfers = body.cleanupOrphanedTransfers !== false; // 默认true
  const cleanupOrphanedFlows = body.cleanupOrphanedFlows !== false; // 默认true
  const cleanupDuplicateFlows = body.cleanupDuplicateFlows !== false; // 默认true
  const specificTransferIds = body.specificTransferIds || []; // 指定要清理的transfer ID列表

  if (!confirm) {
    return error("请设置 confirm=true 来确认执行清理操作");
  }

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let deletedTransfers = 0;
      let cleanedFlows = 0;
      let deletedDuplicateFlows = 0;
      const deletedTransferIds: number[] = [];
      const cleanedFlowIds: number[] = [];
      const deletedFlowIds: number[] = [];

      // 1. 清理孤立transfer（没有关联flows的transfer）
      if (cleanupOrphanedTransfers) {
        const orphanedTransfers = await tx.transfer.findMany({
          where: {
            userId,
            flows: { none: {} },
            ...(specificTransferIds.length > 0 ? { id: { in: specificTransferIds } } : {})
          },
          include: {
            fromAccount: true,
            toAccount: true
          }
        });

        if (orphanedTransfers.length > 0) {
          // 回滚余额影响
          for (const transfer of orphanedTransfers) {
            await tx.account.update({
              where: { id: transfer.fromAccountId },
              data: { balance: { increment: transfer.amount } }
            });
            await tx.account.update({
              where: { id: transfer.toAccountId },
              data: { balance: { decrement: transfer.amount } }
            });
          }

          const deleteResult = await tx.transfer.deleteMany({
            where: {
              id: { in: orphanedTransfers.map(t => t.id) }
            }
          });
          deletedTransfers = deleteResult.count;
          deletedTransferIds.push(...orphanedTransfers.map(t => t.id));
        }
      }

      // 2. 清理孤立flow（transferId指向不存在的transfer）
      if (cleanupOrphanedFlows) {
        // 获取所有存在的transfer ID
        const existingTransferIds = await tx.transfer.findMany({
          where: { userId },
          select: { id: true }
        });
        const existingIds = new Set(existingTransferIds.map(t => t.id));

        // 查找所有有transferId的flow
        const flowsWithTransferId = await tx.flow.findMany({
          where: {
            userId,
            transferId: { not: null }
          }
        });

        // 找出transferId不存在的flow
        const orphanedFlows = flowsWithTransferId.filter(f => 
          f.transferId && !existingIds.has(f.transferId)
        );

        if (orphanedFlows.length > 0) {
          // 将transferId设为null，并回滚余额影响
          for (const flow of orphanedFlows) {
            // 回滚余额影响
            if (flow.accountId) {
              const balanceChange = flow.flowType === "收入" 
                ? -(flow.money || 0) 
                : (flow.money || 0);
              await tx.account.update({
                where: { id: flow.accountId },
                data: { balance: { increment: balanceChange } }
              });
            }

            await tx.flow.update({
              where: { id: flow.id },
              data: { transferId: null }
            });
            cleanedFlowIds.push(flow.id);
          }
          cleanedFlows = orphanedFlows.length;
        }
      }

      // 3. 清理重复flow（同一个transfer有多条相同类型的flow）
      if (cleanupDuplicateFlows) {
        // 获取所有transfer及其flows
        const allTransfers = await tx.transfer.findMany({
          where: {
            userId,
            ...(specificTransferIds.length > 0 ? { id: { in: specificTransferIds } } : {})
          },
          include: {
            flows: true
          }
        });

        for (const transfer of allTransfers) {
          if (transfer.flows && transfer.flows.length > 0) {
            // 按flowType和accountId分组
            const flowsByType = new Map<string, any[]>();
            transfer.flows.forEach(flow => {
              const key = `${flow.flowType}_${flow.accountId}`;
              if (!flowsByType.has(key)) {
                flowsByType.set(key, []);
              }
              flowsByType.get(key)!.push(flow);
            });

            // 处理每个分组，保留第一条，删除其他
            for (const [key, flows] of flowsByType.entries()) {
              if (flows.length > 1) {
                // 按ID排序，保留第一条（通常是较早创建的）
                flows.sort((a, b) => a.id - b.id);
                const toKeep = flows[0];
                const toDelete = flows.slice(1);

                // 回滚要删除的flow的余额影响
                for (const flow of toDelete) {
                  if (flow.accountId) {
                    const balanceChange = flow.flowType === "收入" 
                      ? -(flow.money || 0) 
                      : (flow.money || 0);
                    await tx.account.update({
                      where: { id: flow.accountId },
                      data: { balance: { increment: balanceChange } }
                    });
                  }
                }

                // 删除重复的flow
                const deleteResult = await tx.flow.deleteMany({
                  where: {
                    id: { in: toDelete.map(f => f.id) }
                  }
                });
                deletedDuplicateFlows += deleteResult.count;
                deletedFlowIds.push(...toDelete.map(f => f.id));
              }
            }
          }
        }
      }

      return {
        deletedTransfers,
        cleanedFlows,
        deletedDuplicateFlows,
        deletedTransferIds,
        cleanedFlowIds,
        deletedFlowIds
      };
    });

    return success(result);
  } catch (err: any) {
    console.error('清理孤立记录失败:', err);
    return error(err.message || '清理孤立记录失败');
  }
});

