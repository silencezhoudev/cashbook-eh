import { LoanService } from '~/server/utils/loanService';
import { getUserId, success, error } from '~/server/utils/common';

/**
 * @swagger
 * /api/entry/loan/validate:
 *   get:
 *     summary: 验证借贷数据一致性
 *     tags: ["Loan"]
 *     security:
 *       - Authorization: []
 *     responses:
 *       200:
 *         description: 验证结果
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: {
 *                   hasDuplicateRecords: boolean,
 *                   duplicateCount: number,
 *                   records: array
 *                 }
 *       400:
 *         description: 验证失败
 */
export default defineEventHandler(async (event) => {
  try {
    const userId = await getUserId(event);
    const result = await LoanService.validateLoanDataConsistency(userId);
    
    return success(result);
  } catch (err) {
    console.error('验证借贷数据失败:', err);
    return error('验证借贷数据失败');
  }
});
