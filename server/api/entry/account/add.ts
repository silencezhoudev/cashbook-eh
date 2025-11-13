import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/entry/account/add:
 *   post:
 *     summary: 添加账户
 *     tags: ["Account"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             name: string 账户名称
 *             type: string 账户类型
 *             balance: number 初始余额
 *             currency: string 货币类型
 *             includeInTotal: boolean 是否计入总资产
 *     responses:
 *       200:
 *         description: 账户添加成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: Account 账户信息
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  if (!body.name) {
    return error("请填写账户名称");
  }
  
  const userId = await getUserId(event);
  
  // 检查账户名称是否重复（基于 userId）
  const existingAccount = await prisma.account.findFirst({
    where: {
      userId: userId,
      name: body.name
    }
  });
  
  if (existingAccount) {
    return error("账户名称已存在");
  }
  
  const account = await prisma.account.create({
    data: {
      userId: userId,
      name: body.name,
      type: body.type || "现金",
      balance: Number(body.balance) || 0,
      currency: body.currency || "CNY",
      includeInTotal: body.includeInTotal !== false
    }
  });
  
  return success(account);
});
