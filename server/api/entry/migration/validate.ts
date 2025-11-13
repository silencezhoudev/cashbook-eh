import { BalanceService } from "~/server/utils/balanceService";
import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/entry/migration/validate:
 *   post:
 *     summary: 验证数据完整性
 *     tags: ["Migration"]
 *     security:
 *       - Authorization: []
 *     responses:
 *       200:
 *         description: 数据验证完成
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  
  try {
    const accounts = await prisma.account.findMany({
      where: { userId: userId }
    });
    
    const validationResults = [];
    
    for (const account of accounts) {
      const validation = await BalanceService.validateAccountBalance(account.id);
      validationResults.push({
        accountId: account.id,
        accountName: account.name,
        ...validation
      });
    }
    
    const invalidAccounts = validationResults.filter(r => !r.isValid);
    
    return success({
      totalAccounts: accounts.length,
      invalidAccounts: invalidAccounts.length,
      validationResults,
      isValid: invalidAccounts.length === 0
    });
    
  } catch (err: unknown) {
    console.error("数据验证失败:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return error(`数据验证失败: ${errorMessage}`);
  }
});
