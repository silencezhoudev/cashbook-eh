import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/flow/type/getCategoriesWithStats:
 *   post:
 *     summary: 获取分类列表(带使用频率和最后使用时间)
 *     tags: ["Flow Type"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookIds: string[] 账本ID列表(可选,如果提供则只返回这些账本的分类)
 *             flowType: string 流水类型(可选,默认"支出")
 *     responses:
 *       200:
 *         description: 分类列表获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: [] # { category: 分类名称, count: 使用次数, lastUsed: 最后使用时间(ISO字符串) }
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  if (!userId) {
    return error("请先登录");
  }

  const body = await readBody(event);
  const bookIds: string[] | undefined = Array.isArray(body?.bookIds) && body.bookIds.length > 0 ? body.bookIds : undefined;
  const flowType: string = body?.flowType || "支出";

  const where: any = {
    userId,
    flowType,
    industryType: {
      not: null,
    },
    eliminate: { not: 1 },
    transferId: null,
  };

  // 如果提供了账本ID列表,则只查询这些账本的分类
  if (bookIds && bookIds.length > 0) {
    where.bookId = { in: bookIds };
  }

  // 查询所有符合条件的流水,按分类分组统计
  const flows = await prisma.flow.findMany({
    where,
    select: {
      industryType: true,
      day: true,
    },
    orderBy: {
      day: "desc",
    },
  });

  // 统计每个分类的使用次数和最后使用时间
  const categoryStats = new Map<
    string,
    { count: number; lastUsed: Date | null }
  >();

  flows.forEach((flow) => {
    if (!flow.industryType) {
      return;
    }

    const category = flow.industryType;
    const existing = categoryStats.get(category);
    const flowDay = flow.day ? new Date(flow.day) : null;

    if (existing) {
      existing.count++;
      // 更新最后使用时间(因为已经按day desc排序,所以第一个就是最新的)
      if (!existing.lastUsed || (flowDay && existing.lastUsed && flowDay > existing.lastUsed)) {
        existing.lastUsed = flowDay;
      }
    } else {
      categoryStats.set(category, {
        count: 1,
        lastUsed: flowDay,
      });
    }
  });

  // 转换为数组并排序
  const categories = Array.from(categoryStats.entries())
    .map(([category, stats]) => ({
      category,
      count: stats.count,
      lastUsed: stats.lastUsed ? stats.lastUsed.toISOString() : null,
    }))
    .sort((a, b) => {
      // 先按使用频率降序排序
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      // 如果使用频率相同,按最后使用时间降序排序
      if (a.lastUsed && b.lastUsed) {
        return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
      }
      // 如果有最后使用时间的排在前面
      if (a.lastUsed && !b.lastUsed) {
        return -1;
      }
      if (!a.lastUsed && b.lastUsed) {
        return 1;
      }
      return 0;
    });

  return success(categories);
});

