import { UnifiedTransferService } from '~/server/utils/unifiedTransferService';
import { getUserId, success, error } from '~/server/utils/common';

/**
 * @swagger
 * /api/entry/unified-transfer/del:
 *   post:
 *     summary: 删除统一转账记录
 *     tags: ["UnifiedTransfer"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             id: number 转账记录ID
 *     responses:
 *       200:
 *         description: 转账记录删除成功
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  if (!body.id) {
    return error("缺少转账记录ID");
  }
  
  const userId = await getUserId(event);
  
  try {
    const result = await UnifiedTransferService.deleteTransfer(Number(body.id), userId);
    return success(result);
  } catch (err) {
    console.error('删除转账记录失败:', err);
    return error(err.message || '删除转账记录失败');
  }
});
