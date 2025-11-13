import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/checkuser:
 *   get:
 *     summary: 检查用户登录状态
 *     tags: ["Base"]
 *     security:
 *       - Authorization: []
 *     responses:
 *       200:
 *         description: 用户信息获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result: {
 *                 d: {
 *                   id: 用户ID,
 *                   name: 用户姓名,
 *                   username: 用户名,
 *                   createDate: 创建日期
 *                 }
 *               }
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  console.log("Checkuser - userId:", userId);

  // 如果 userId 为 0，说明 token 无效或不存在
  if (userId === 0) {
    console.log("Checkuser - Token invalid or missing");
    deleteCookie(event, "Authorization");
    return {
      c: 400,
      m: "Token invalid or missing",
      d: null,
    };
  }

  const user = await prisma.user.findUnique({
    select: {
      id: true,
      name: true,
      username: true,
      createDate: true,
    },
    where: {
      id: userId,
    },
  });

  if (!user) {
    console.log("Checkuser - User not found for userId:", userId);
    deleteCookie(event, "Authorization");
    return {
      c: 400,
      m: "User not found",
      d: null,
    };
  }

  console.log("Checkuser - User found:", user.username);
  return success(user);
});
