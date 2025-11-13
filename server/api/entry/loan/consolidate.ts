import { LoanService } from '~/server/utils/loanService';
import { getUserId, success, error } from '~/server/utils/common';

/**
 * @swagger
 * /api/entry/loan/consolidate:
 *   post:
 *     summary: 合并重复的借贷记录
 *     tags: ["Loan"]
 *     security:
 *       - Authorization: []
 *     responses:
 *       200:
 *         description: 合并成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: {
 *                   totalMerged: number,
 *                   createdTransfers: number
 *                 }
 *       400:
 *         description: 合并失败
 */
export default defineEventHandler(async (event) => {
  try {
    const userId = await getUserId(event);
    const result = await LoanService.consolidateDuplicateLoanRecords(userId);
    
    return success({
      totalMerged: result.totalMerged,
      createdTransfers: result.createdTransfers,
      message: `成功合并 ${result.totalMerged} 条重复记录，创建 ${result.createdTransfers} 条转账记录`
    });
  } catch (err) {
    console.error('合并借贷记录失败:', err);
    return error('合并借贷记录失败');
  }
});