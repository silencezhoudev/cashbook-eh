import { defineEventHandler, readBody } from 'h3';
import { getUserId, success, error } from "~/server/utils/common";
import { LoanFlowService } from "~/server/utils/loanFlowService";

/**
 * @swagger
 * /api/entry/loan/process-flows:
 *   post:
 *     summary: 处理借贷流水数据，创建对应的转账记录
 *     tags: ["Loan"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force: boolean 是否强制处理（可选，默认false）
 *     responses:
 *       200:
 *         description: 处理成功
 *         content:
 *           application/json:
 *             schema:
 *               Result: {
 *                 d: {
 *                   total: number, 处理总数
 *                   success: number, 成功数量
 *                   error: number, 失败数量
 *                   errors: string[] 错误信息列表
 *                 }
 *               }
 *       400:
 *         description: 处理失败
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const userId = await getUserId(event);
  
  try {
    const validation = await LoanFlowService.validateLoanFlowConsistency(userId);
    
    if (!validation.needsProcessing && !body.force) {
      return success({
        message: "所有借贷流水已正确处理，无需重复处理",
        validation
      });
    }

    const result = await LoanFlowService.processAllLoanFlows(userId);
    
    await LoanFlowService.recalculateAccountBalances(userId);
    
    return success({
      message: "借贷流水处理完成",
      ...result,
      validation
    });
    
  } catch (err) {
    console.error('处理借贷流水失败:', err);
    return error("处理借贷流水失败: " + (err instanceof Error ? err.message : String(err)));
  }
});
