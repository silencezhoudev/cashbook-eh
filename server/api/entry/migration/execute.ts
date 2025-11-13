import { SafeMigration } from "~/server/utils/safeMigration";
import { BalanceService } from "~/server/utils/balanceService";
import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/entry/migration/execute:
 *   post:
 *     summary: 执行数据迁移
 *     tags: ["Migration"]
 *     security:
 *       - Authorization: []
 *     responses:
 *       200:
 *         description: 数据迁移执行成功
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  
  // 检查用户权限（这里可以添加管理员权限检查）
  // 暂时允许所有用户执行迁移
  
  try {
    const result = await SafeMigration.executeFullMigration();
    
    if (result.success) {
      return success({
        message: result.message,
        results: result.results
      });
    } else {
      return error(result.message);
    }
  } catch (err: unknown) {
    console.error("数据迁移执行失败:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return error(`数据迁移执行失败: ${errorMessage}`);
  }
});
