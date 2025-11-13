import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/entry/account/del:
 *   post:
 *     summary: 删除账户
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
 *     responses:
 *       200:
 *         description: 账户删除成功
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  if (!body.id) {
    return error("缺少账户ID");
  }
  
  const userId = await getUserId(event);
  
  // 检查账户是否存在且属于当前用户
  const account = await prisma.account.findFirst({
    where: {
      id: Number(body.id),
      userId: userId
    }
  });
  
  if (!account) {
    return error("账户不存在");
  }
  
  // 检查是否有流水记录关联
  const flowCount = await prisma.flow.count({
    where: { accountId: Number(body.id) }
  });
  
  if (flowCount > 0) {
    return error("该账户还有流水记录，无法删除。请先将流水记录转移到其他账户。");
  }
  
  // 检查是否有转账记录关联
  const transferCount = await prisma.transfer.count({
    where: {
      OR: [
        { fromAccountId: Number(body.id) },
        { toAccountId: Number(body.id) }
      ]
    }
  });
  
  if (transferCount > 0) {
    return error("该账户还有转账记录，无法删除。");
  }
  
  // 删除账户
  await prisma.account.delete({
    where: { id: Number(body.id) }
  });
  
  return success({ message: "账户删除成功" });
});
