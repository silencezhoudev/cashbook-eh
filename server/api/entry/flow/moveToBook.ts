import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";
import { BalanceService } from "~/server/utils/balanceService";

/**
 * @swagger
 * /api/entry/flow/moveToBook:
 *   post:
 *     summary: 批量将流水和转账记录移动到另一个账本
 *     tags: ["Flow"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             ids: (string|number)[] 需要移动的记录ID集合，支持 "flow_123"、"transfer_456" 或纯数字
 *             fromBookId: string 源账本ID
 *             toBookId: string 目标账本ID
 *     responses:
 *       200:
 *         description: 移动成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: {
 *                   movedFlows: number 移动的普通流水数量
 *                   movedTransfers: number 移动的转账记录数量
 *                   totalMoved: number 总移动数量
 *                 }
 *       400:
 *         description: 参数错误
 *     notes: |
 *       支持移动所有类型的流水记录：
 *       - 普通流水（收入、支出、不计收支）
 *       - 借贷记录（借入、借出、收款、还款）
 *       - 转账记录
 *       
 *       移动规则：
 *       - 普通流水：仅更新 bookId，保持账户关联和借贷关联不变
 *       - 转账记录：保持转账完整性，通过更新关联流水的账本实现移动
 *       - 所有业务逻辑（计入收支、余额变动、借贷关联等）保持不变
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const userId = await getUserId(event);

    const { ids, fromBookId, toBookId } = body || {};
    if (!ids || !Array.isArray(ids) || !fromBookId || !toBookId) {
      return error("参数不完整");
    }
    if (fromBookId === toBookId) {
      return error("目标账本与源账本相同");
    }

    const [fromBook, toBook] = await Promise.all([
      prisma.book.findFirst({ where: { bookId: String(fromBookId), userId } }),
      prisma.book.findFirst({ where: { bookId: String(toBookId), userId } }),
    ]);
    if (!fromBook || !toBook) {
      return error("账本不存在或无权限");
    }

    const numericFlowIds: number[] = [];
    const numericTransferIds: number[] = [];
    
    ids.forEach((raw: any) => {
      if (typeof raw === "string") {
        if (raw.startsWith("flow_")) {
          const id = parseInt(raw.slice(5), 10);
          if (!Number.isNaN(id) && id > 0) numericFlowIds.push(id);
        } else if (raw.startsWith("transfer_")) {
          const id = parseInt(raw.slice(9), 10);
          if (!Number.isNaN(id) && id > 0) numericTransferIds.push(id);
        } else {
          const parsed = parseInt(raw, 10);
          if (!Number.isNaN(parsed) && parsed > 0) numericFlowIds.push(parsed);
        }
      } else if (typeof raw === "number" && raw > 0) {
        numericFlowIds.push(raw);
      }
    });

    if (numericFlowIds.length === 0 && numericTransferIds.length === 0) {
      return error("没有有效的记录可移动");
    }

    const result = await prisma.$transaction(async (tx) => {
      let movedFlows = 0;
      let movedTransfers = 0;
      const affectedAccountIds = new Set<number>();

      if (numericFlowIds.length > 0) {
        const flows = await tx.flow.findMany({
          where: {
            id: { in: numericFlowIds },
            userId: userId,
            bookId: String(fromBookId),
            transferId: null,
          },
          select: { 
            id: true, 
            accountId: true, 
            relatedFlowId: true,
            loanType: true,
            counterparty: true
          },
        });

        if (flows.length > 0) {
          const validFlowIds = flows.map((f) => f.id);
          
          flows.forEach((f) => {
            if (f.accountId) affectedAccountIds.add(f.accountId);
          });

          const updateData: any = {
            bookId: String(toBookId)
          };
          
          const flowUpdateResult = await tx.flow.updateMany({
            where: {
              id: { in: validFlowIds },
              userId: userId,
              bookId: String(fromBookId),
              transferId: null
            },
            data: updateData,
          });
          
          movedFlows = flowUpdateResult.count;
        }
      }

      if (numericTransferIds.length > 0) {
        const transfers = await tx.transfer.findMany({
          where: {
            id: { in: numericTransferIds },
            userId: userId,
            flows: {
              some: {
                bookId: String(fromBookId)
              }
            }
          },
          include: {
            flows: {
              where: {
                bookId: String(fromBookId)
              }
            }
          }
        });

        for (const transfer of transfers) {
          affectedAccountIds.add(transfer.fromAccountId);
          affectedAccountIds.add(transfer.toAccountId);

          const transferFlowUpdateResult = await tx.flow.updateMany({
            where: {
              transferId: transfer.id,
              bookId: String(fromBookId),
            },
            data: {
              bookId: String(toBookId),
            },
          });
          
          if (transferFlowUpdateResult.count > 0) {
            movedTransfers++;
          }
        }
      }

      for (const accountId of affectedAccountIds) {
        await BalanceService.updateAccountBalance(accountId, tx);
      }

      return { 
        movedFlows, 
        movedTransfers,
        totalMoved: movedFlows + movedTransfers 
      };
    });

    return success(result);
  } catch (e) {
    console.error("moveToBook error", e);
    return error("Move failed: " + (e as Error).message);
  }
});


