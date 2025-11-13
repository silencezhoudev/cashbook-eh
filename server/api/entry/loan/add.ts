import { LoanService } from '~/server/utils/loanService';
import { getUserId, success, error } from '~/server/utils/common';

/**
 * @swagger
 * /api/entry/loan/add:
 *   post:
 *     summary: 添加借贷记录
 *     tags: ["Loan"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             loanType: string 借贷类型（借入、借出、收款、还款）
 *             fromAccountId: number 转出账户ID
 *             toAccountId: number 转入账户ID
 *             amount: number 金额
 *             day: string 日期
 *             counterparty: string 借贷对象
 *             description: string 备注
 *             attribution: string 归属
 *     responses:
 *       200:
 *         description: 借贷记录创建成功
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
  
  if (!body.bookId || !body.loanType || !body.fromAccountId || !body.toAccountId || !body.amount) {
    return error("请填写必要信息");
  }
  
  const validLoanTypes = ['借入', '借出', '收款', '还款'];
  if (!validLoanTypes.includes(body.loanType)) {
    return error(`借贷类型必须是以下之一: ${validLoanTypes.join(', ')}`);
  }
  
  if (body.fromAccountId === body.toAccountId) {
    return error("转出账户和转入账户不能相同");
  }
  
  if (Number(body.amount) <= 0) {
    return error("金额必须大于0");
  }
  
  const userId = await getUserId(event);
  
  try {
    const transfer = await LoanService.createLoanRecord({
      userId,
      bookId: body.bookId,
      day: body.day || new Date().toISOString().split("T")[0],
      loanType: body.loanType,
      fromAccountId: Number(body.fromAccountId),
      toAccountId: Number(body.toAccountId),
      amount: Number(body.amount),
      counterparty: body.counterparty || '未知',
      description: body.description,
      attribution: body.attribution
    });
    
    return success(transfer);
  } catch (err) {
    console.error('创建借贷记录失败:', err);
    return error('创建借贷记录失败');
  }
});
