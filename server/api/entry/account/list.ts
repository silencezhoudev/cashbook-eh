import prisma from "~/lib/prisma";
import type { Account } from "~/utils/model";
import { getUserId, success } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/account/list:
 *   post:
 *     summary: 获取账户列表
 *     tags: ["Account"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             includeHidden: boolean 是否包含隐藏账户
 *     responses:
 *       200:
 *         description: 账户列表获取成功
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  const userId = await getUserId(event);
  
  const where: any = {
    userId: userId
  };
  
  if (!body.includeHidden) {
    where.isHidden = false;
  }
  
  const accounts = await prisma.account.findMany({
    where,
    orderBy: [
      { isHidden: "asc" },
      { createDate: "asc" }
    ]
  });
  
  // 计算账户统计信息（账户页不绑定账本，统计应跨所有账本）
  const accountStats = await Promise.all(
    accounts.map(async (account: any) => {
      // 流水统计：排除转账生成的流水记录，避免重复计算
      const flowWhere: any = { 
        accountId: account.id,
        transferId: null  // 排除转账生成的流水记录
      };
      const flowStats = await prisma.flow.groupBy({
        by: ["flowType"],
        where: flowWhere,
        _sum: { money: true },
        _count: { id: true }
      });
      
      // 转账统计：统计该账户相关的转账记录
      const transferWhere: any = {
        OR: [
          { fromAccountId: account.id },
          { toAccountId: account.id }
        ]
      };
      const transferStats = await prisma.transfer.groupBy({
        by: ["fromAccountId", "toAccountId"],
        where: transferWhere,
        _sum: { amount: true },
        _count: { id: true }
      });
      
      return {
        ...account,
        flowStats,
        transferStats
      };
    })
  );
  
  return success(accountStats);
});
