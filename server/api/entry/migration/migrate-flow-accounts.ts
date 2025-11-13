import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/entry/migration/migrate-flow-accounts:
 *   post:
 *     summary: 迁移流水账户数据
 *     tags: ["Migration"]
 *     security:
 *       - Authorization: []
 *     responses:
 *       200:
 *         description: 迁移完成
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: {
 *                   migratedCount: number 迁移的流水数量
 *                   createdAccountCount: number 创建的账户数量
 *                   totalFlows: number 总流水数量
 *                   flowsWithAccount: number 有账户关联的流水数量
 *                 }
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  
  // 检查是否为管理员
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user || user.username !== 'admin') {
    return error("权限不足，只有管理员可以执行此操作");
  }
  
  try {
    console.log('开始迁移流水账户数据...');
    
    // 查找没有账户关联的流水
    const flowsWithoutAccount = await prisma.flow.findMany({
      where: { 
        accountId: null,
        description: { not: null }
      },
      take: 1000 // 限制每次处理的数量
    });
    
    let migratedCount = 0;
    let createdAccountCount = 0;
    
    for (const flow of flowsWithoutAccount) {
      try {
        // 尝试从流水信息推断账户
        const accountName = inferAccountFromFlow(flow);
        
        if (accountName) {
          // 查找或创建账户
          let account = await prisma.account.findFirst({
            where: {
              userId: flow.userId,
              name: accountName
            }
          });
          
          if (!account) {
            // 创建新账户
            account = await prisma.account.create({
              data: {
                userId: flow.userId,
                name: accountName,
                type: inferAccountType(accountName),
                balance: 0,
                currency: "CNY"
              }
            });
            createdAccountCount++;
          }
          
          // 更新流水记录
          await prisma.flow.update({
            where: { id: flow.id },
            data: { accountId: account.id }
          });
          
          migratedCount++;
        }
      } catch (error) {
        console.error(`迁移流水 ${flow.id} 失败:`, error);
      }
    }
    
    // 统计结果
    const totalFlows = await prisma.flow.count();
    const flowsWithAccount = await prisma.flow.count({
      where: { accountId: { not: null } }
    });
    
    const result = {
      migratedCount,
      createdAccountCount,
      totalFlows,
      flowsWithAccount,
      coverage: ((flowsWithAccount / totalFlows) * 100).toFixed(2) + '%'
    };
    
    console.log('迁移完成:', result);
    
    return success(result);
    
  } catch (err) {
    console.error('迁移失败:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return error(`迁移失败: ${errorMessage}`);
  }
});

/**
 * 从流水信息推断账户名称
 */
function inferAccountFromFlow(flow: any): string | null {
  // 从描述中提取账户信息
  if (flow.description) {
    const desc = flow.description.toLowerCase();
    
    // 检查常见的账户关键词
    const accountKeywords = [
      '建设银行', '工商银行', '农业银行', '中国银行',
      '招商银行', '交通银行', '民生银行', '光大银行',
      '支付宝', '微信', '现金', '银行卡', '信用卡'
    ];
    
    for (const keyword of accountKeywords) {
      if (desc.includes(keyword.toLowerCase())) {
        return keyword;
      }
    }
    
    // 从描述中提取可能的账户名称
    const patterns = [
      /(\w+银行)/,
      /(支付宝)/,
      /(微信)/,
      /(现金)/,
      /(银行卡)/
    ];
    
    for (const pattern of patterns) {
      const match = flow.description.match(pattern);
      if (match) {
        return match[1];
      }
    }
  }
  
  // 从流水名称中提取
  if (flow.name) {
    const name = flow.name.toLowerCase();
    if (name.includes('银行') || name.includes('支付宝') || name.includes('微信')) {
      return flow.name;
    }
  }
  
  return null;
}

/**
 * 推断账户类型
 */
function inferAccountType(accountName: string): string {
  const name = accountName.toLowerCase();
  
  if (name.includes('建设银行') || name.includes('工商银行') || 
      name.includes('农业银行') || name.includes('中国银行') ||
      name.includes('招商银行') || name.includes('交通银行') ||
      name.includes('储蓄卡') || name.includes('借记卡')) {
    return '银行卡';
  }
  
  if (name.includes('信用卡') || name.includes('贷记卡')) {
    return '信用卡';
  }
  
  if (name.includes('支付宝') || name.includes('微信') || 
      name.includes('电子钱包') || name.includes('余额宝')) {
    return '电子钱包';
  }
  
  if (name.includes('现金') || name.includes('钱包')) {
    return '现金';
  }
  
  return '其他';
}
