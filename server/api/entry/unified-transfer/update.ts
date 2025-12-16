import { UnifiedTransferService } from '~/server/utils/unifiedTransferService';
import { getUserId, success, error } from '~/server/utils/common';

/**
 * @swagger
 * /api/entry/unified-transfer/update:
 *   post:
 *     summary: 更新统一转账记录（支持借贷和转账）
 *     tags: ["UnifiedTransfer"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             id: number 转账记录ID
 *             bookId: string 账本ID
 *             transferType: string 转账类型（transfer: 转账, loan: 借贷，可选）
 *             fromAccountId: number 转出账户ID（可选）
 *             toAccountId: number 转入账户ID（可选）
 *             amount: number 金额（可选）
 *             day: string 日期（可选）
 *             name: string 转账说明（可选）
 *             description: string 备注（可选）
 *             loanType: string 借贷类型（借入、借出、收款、还款，可选）
 *             counterparty: string 借贷对象（可选）
 *     responses:
 *       200:
 *         description: 转账记录更新成功
 *       400:
 *         description: 更新失败
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.id || !body.bookId) {
    return error("缺少必要参数");
  }

  const userId = await getUserId(event);

  // 验证转账类型（如果提供）
  if (body.transferType) {
    const validTransferTypes = ['transfer', 'loan'];
    if (!validTransferTypes.includes(body.transferType)) {
      return error(`转账类型必须是以下之一: ${validTransferTypes.join(', ')}`);
    }
  }

  try {
    const result = await UnifiedTransferService.updateTransfer({
      transferId: Number(body.id),
      userId,
      bookId: body.bookId,
      day: body.day,
      transferType: body.transferType,
      fromAccountId: body.fromAccountId ? Number(body.fromAccountId) : undefined,
      toAccountId: body.toAccountId ? Number(body.toAccountId) : undefined,
      amount: body.amount ? Number(body.amount) : undefined,
      name: body.name,
      description: body.description,
      loanType: body.loanType,
      counterparty: body.counterparty
    });

    return success(result);
  } catch (err: any) {
    console.error('更新转账记录失败:', err);
    return error(err.message || '更新转账记录失败');
  }
});

