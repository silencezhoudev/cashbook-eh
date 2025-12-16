import { getUserId, success, error } from "~/server/utils/common";
import { RuleLearnerService } from "~/server/utils/ruleLearnerService";
import type { ParsedFlow } from "~/server/utils/flowParser";

/**
 * @swagger
 * /api/rules/learn:
 *   post:
 *     summary: 从用户手动修改中学习并生成规则
 *     tags: ["Rules"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             flow: Flow 原始流水字段
 *             targetBookId: string 新的账本ID
 *             targetCategory: string 新的分类（可选）
 *             targetFlowType: string 新的流水类型（可选）
 *     responses:
 *       200:
 *         description: 学习成功
 *       400:
 *         description: 学习失败
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  if (!userId) {
    return error("请先登录");
  }

  try {
    const body = await readBody(event);
    const { flow, targetBookId, targetCategory, targetFlowType } = body;

    if (!flow) {
      return error("缺少流水数据");
    }

    if (!targetBookId) {
      return error("缺少目标账本ID");
    }

    // 验证账本是否存在
    const prisma = (await import("~/lib/prisma")).default;
    const book = await prisma.book.findFirst({
      where: {
        bookId: targetBookId,
        userId,
      },
    });

    if (!book) {
      return error("账本不存在或无权限访问");
    }

    // 调用学习服务
    const result = await RuleLearnerService.learn({
      flow: flow as ParsedFlow,
      targetBookId,
      targetCategory,
      targetFlowType,
      userId,
    });

    if (result.success) {
      return success({
        success: true,
        ruleId: result.ruleId,
        ruleType: result.ruleType,
        message: result.message,
      });
    } else {
      return error(result.message || "学习失败");
    }
  } catch (err: any) {
    console.error("[rules/learn] 学习失败:", err);
    return error(err?.message || "学习失败，请重试");
  }
});

