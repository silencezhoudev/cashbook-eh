import { UnifiedTransferService } from '~/server/utils/unifiedTransferService';
import { getUserId, success, error } from '~/server/utils/common';

/**
 * @swagger
 * /api/entry/unified-transfer/add:
 *   post:
 *     summary: 创建统一转账记录（支持借贷和转账）
 *     tags: ["UnifiedTransfer"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             transferType: string 转账类型（transfer: 转账, loan: 借贷）
 *             fromAccountId: number 转出账户ID
 *             toAccountId: number 转入账户ID
 *             amount: number 金额
 *             day: string 日期
 *             name: string 转账说明（可选）
 *             description: string 备注（可选）
 *             loanType: string 借贷类型（借入、借出、收款、还款）
 *             counterparty: string 借贷对象
 *     responses:
 *       200:
 *         description: 转账记录创建成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: Transfer 转账记录
 *       400:
 *         description: 创建失败
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body.bookId || !body.transferType || !body.fromAccountId || !body.toAccountId || !body.amount) {
    return error("请填写必要信息");
  }

  const validTransferTypes = ['transfer', 'loan'];
  if (!validTransferTypes.includes(body.transferType)) {
    return error(`转账类型必须是以下之一: ${validTransferTypes.join(', ')}`);
  }

  if (body.transferType === 'loan') {
    const validLoanTypes = ['借入', '借出', '收款', '还款'];
    if (!body.loanType || !validLoanTypes.includes(body.loanType)) {
      return error(`借贷类型必须是以下之一: ${validLoanTypes.join(', ')}`);
    }
    if (!body.counterparty) {
      return error("借贷对象不能为空");
    }
  }
  if (body.fromAccountId === body.toAccountId) {
    return error("转出账户和转入账户不能相同");
  }
  
  if (Number(body.amount) <= 0) {
    return error("金额必须大于0");
  }
  const userId = await getUserId(event);
  
  try {
    const result = await UnifiedTransferService.createTransfer({
      userId,
      bookId: body.bookId,
      day: body.day || new Date().toISOString().split("T")[0],
      transferType: body.transferType,
      fromAccountId: Number(body.fromAccountId),
      toAccountId: Number(body.toAccountId),
      amount: Number(body.amount),
      name: body.name,
      description: body.description,
      loanType: body.loanType,
      counterparty: body.counterparty
    });
    
    return success(result);
  } catch (err) {
    console.error('创建转账记录失败:', err);
    return error(err.message || '创建转账记录失败');
  }
});
