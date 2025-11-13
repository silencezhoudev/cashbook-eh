import { defineEventHandler, readBody } from 'h3';
import { getUserId, success, error } from "~/server/utils/common";
import { LoanFlowService } from "~/server/utils/loanFlowService";

/**
 * @swagger
 * /api/entry/loan/validate-flows:
 *   post:
 *     summary: 验证借贷流水数据一致性
 *     tags: ["Loan"]
 *     security:
 *       - Authorization: []
 *     responses:
 *       200:
 *         description: 验证成功
 *         content:
 *           application/json:
 *             schema:
 *               Result: {
 *                 d: {
 *                   unlinkedLoanFlows: Flow[], 未关联转账的借贷流水
 *                   linkedLoanFlows: Flow[], 已关联转账的借贷流水
 *                   invalidTransfers: Flow[], 无效转账关联的借贷流水
 *                   needsProcessing: boolean 是否需要处理
 *                 }
 *               }
 *       400:
 *         description: 验证失败
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  
  try {
    const validation = await LoanFlowService.validateLoanFlowConsistency(userId);
    const statistics = await LoanFlowService.getLoanFlowStatistics(userId);
    
    return success({
      validation,
      statistics
    });
    
  } catch (err) {
    console.error('验证借贷流水失败:', err);
    return error("验证借贷流水失败: " + (err instanceof Error ? err.message : String(err)));
  }
});
