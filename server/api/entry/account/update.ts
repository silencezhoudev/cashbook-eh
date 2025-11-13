import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/entry/account/update:
 *   post:
 *     summary: 更新账户信息
 *     tags: ["Account"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             id: number 账户ID
 *             bookId: string 账本ID
 *             name: string 账户名称
 *             type: string 账户类型
 *             currency: string 货币类型
 *             isHidden: boolean 是否隐藏
 *             includeInTotal: boolean 是否计入总资产
 *     responses:
 *       200:
 *         description: 账户更新成功
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  if (!body.id) {
    return error("缺少账户ID");
  }
  
  const userId = await getUserId(event);
  
  // 检查账户是否存在且属于当前用户
  const existingAccount = await prisma.account.findFirst({
    where: {
      id: Number(body.id),
      userId: userId
    }
  });
  
  if (!existingAccount) {
    return error("账户不存在");
  }
  
  // 检查名称是否与其他账户重复（基于 userId）
  if (body.name && body.name !== existingAccount.name) {
    const duplicateAccount = await prisma.account.findFirst({
      where: {
        userId: userId,
        name: body.name,
        id: { not: Number(body.id) }
      }
    });
    
    if (duplicateAccount) {
      return error("账户名称已存在");
    }
  }
  
  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.currency !== undefined) updateData.currency = body.currency;
  if (body.isHidden !== undefined) updateData.isHidden = body.isHidden;
  if (body.includeInTotal !== undefined) updateData.includeInTotal = body.includeInTotal;
  
  const updatedAccount = await prisma.account.update({
    where: { id: Number(body.id) },
    data: updateData
  });
  
  return success(updatedAccount);
});
