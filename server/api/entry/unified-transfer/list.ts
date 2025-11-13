import { UnifiedTransferService } from '~/server/utils/unifiedTransferService';
import { getUserId, success, error } from '~/server/utils/common';

/**
 * @swagger
 * /api/entry/unified-transfer/list:
 *   post:
 *     summary: 获取统一转账记录列表
 *     tags: ["UnifiedTransfer"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             transferType: string 转账类型（可选）
 *             startDay: string 开始日期（可选）
 *             endDay: string 结束日期（可选）
 *             pageNum: number 页码（可选，默认1）
 *             pageSize: number 每页数量（可选，默认100）
 *     responses:
 *       200:
 *         description: 转账记录列表获取成功
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  if (!body.bookId) {
    return error("请提供账本ID");
  }
  
  const userId = await getUserId(event);
  
  try {
    const result = await UnifiedTransferService.getTransferList({
      userId,
      bookId: body.bookId,
      transferType: body.transferType,
      startDay: body.startDay,
      endDay: body.endDay,
      pageNum: body.pageNum,
      pageSize: body.pageSize
    });
    
    return success(result);
  } catch (err) {
    console.error('获取转账记录列表失败:', err);
    return error('获取转账记录列表失败');
  }
});
