import prisma from "~/lib/prisma";
import type { Prisma } from "@prisma/client";
import { BalanceService } from "./balanceService";

/**
 * 账户导入服务
 * 处理账户的创建、匹配和余额更新
 */
export class AccountImportService {
  /**
   * 处理账户导入（创建或匹配）
   */
  static async handleAccountImport(
    tx: Prisma.TransactionClient,
    params: {
      bookId: string;
      userId: number;
      accountName: string;
      accountType?: string;
    }
  ): Promise<number> {
    // 1. 清理账户名称
    const cleanName = this.cleanAccountName(params.accountName);
    
    if (!cleanName) {
      throw new Error('账户名称不能为空');
    }
    
    // 2. 尝试匹配现有账户
    const existingAccount = await this.findExistingAccount(tx, {
      userId: params.userId,
      accountName: cleanName
    });
    
    if (existingAccount) {
      return existingAccount.id;
    }
    
    // 3. 推断账户类型
    const accountType = this.inferAccountType(cleanName, params.accountType);
    
    // 4. 创建新账户
    console.log(`创建新账户: ${cleanName}, 类型: ${accountType}`);
    const newAccount = await tx.account.create({
      data: {
        userId: params.userId,
        name: cleanName,
        type: accountType,
        balance: 0,
        currency: "CNY"
      }
    });
    
    console.log(`新账户创建成功: ID=${newAccount.id}, 名称=${newAccount.name}`);
    return newAccount.id;
  }
  
  /**
   * 清理账户名称
   */
  private static cleanAccountName(name: string): string {
    if (!name) return '';
    
    let cleanName = String(name).trim();
    
    // 移除开头的逗号、空格等无效字符
    cleanName = cleanName.replace(/^[，,、\s]+/, '');
    
    // 移除结尾的逗号、空格等无效字符
    cleanName = cleanName.replace(/[，,、\s]+$/, '');
    
    // 移除数字后缀（如"支付宝总12000" -> "支付宝总", "建设银行储蓄卡17800" -> "建设银行储蓄卡"）
    cleanName = cleanName.replace(/[总]?\d+\.?\d*$/, '');
    
    // 移除银行卡类型后缀
    cleanName = cleanName.replace(/储蓄卡$|借记卡$|信用卡$|电子钱包$|微信支付$|银行卡$/g, '');
    
    // 移除多余的空格
    cleanName = cleanName.replace(/\s+/g, ' ');
    
    // 移除特殊字符，但保留中文、英文、数字和空格
    cleanName = cleanName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '');
    
    const result = cleanName.trim();
    
    // 如果清理后为空或只包含无效字符，返回空字符串
    if (!result || result.length === 0) {
      return '';
    }
    
    return result;
  }
  
  /**
   * 查找现有账户
   */
  private static async findExistingAccount(
    tx: Prisma.TransactionClient,
    params: {
      userId: number;
      accountName: string;
    }
  ): Promise<any> {
    // 1. 精确匹配
    let account = await tx.account.findFirst({
      where: {
        userId: params.userId,
        name: params.accountName
      }
    });
    
    if (account) {
      console.log(`找到精确匹配的账户: ${account.name} (ID=${account.id})`);
      return account;
    }
    
    // 2. 禁用模糊匹配，避免不同账户被错误匹配到同一个账户
    // 只进行精确匹配，确保账户名称完全一致
    console.log(`未找到精确匹配的账户: ${params.accountName}`);
    
    return null;
  }
  
  /**
   * 推断账户类型
   */
  private static inferAccountType(accountName: string, providedType?: string): string {
    if (providedType) {
      return providedType;
    }
    
    const name = accountName.toLowerCase();
    
    // 借贷账户类型
    if (name.includes('借贷') || name.includes('借') || name.includes('贷')) {
      return '借贷账户';
    }
    
    // 银行卡类型
    if (name.includes('建设银行') || name.includes('工商银行') || 
        name.includes('农业银行') || name.includes('中国银行') ||
        name.includes('招商银行') || name.includes('交通银行') ||
        name.includes('储蓄卡') || name.includes('借记卡')) {
      return '银行卡';
    }
    
    // 信用卡
    if (name.includes('信用卡') || name.includes('贷记卡')) {
      return '信用卡';
    }
    
    // 电子钱包
    if (name.includes('支付宝') || name.includes('微信') || 
        name.includes('电子钱包') || name.includes('余额宝')) {
      return '电子钱包';
    }
    
    // 现金
    if (name.includes('现金') || name.includes('钱包')) {
      return '现金';
    }
    
    // 投资账户
    if (name.includes('基金') || name.includes('股票') || 
        name.includes('理财') || name.includes('投资')) {
      return '投资账户';
    }
    
    // 默认类型
    return '其他';
  }
  
  /**
   * 提取银行名称
   */
  private static extractBankName(accountName: string): string {
    const banks = [
      '建设银行', '工商银行', '农业银行', '中国银行',
      '招商银行', '交通银行', '民生银行', '光大银行',
      '华夏银行', '中信银行', '浦发银行', '兴业银行'
    ];
    
    for (const bank of banks) {
      if (accountName.includes(bank)) {
        return bank;
      }
    }
    
    return '';
  }
  
  /**
   * 更新账户余额
   */
  static async updateAccountBalance(
    tx: Prisma.TransactionClient,
    accountId: number
  ): Promise<void> {
    try {
      // 首先检查账户是否存在
      const account = await tx.account.findUnique({
        where: { id: accountId }
      });
      
      if (!account) {
        console.warn(`账户 ${accountId} 不存在，尝试从流水记录中恢复账户信息`);
        
        // 尝试从流水记录中找到账户信息
        const flowWithAccount = await tx.flow.findFirst({
          where: { accountId: accountId }
        });
        
        if (flowWithAccount) {
          console.log(`从流水记录中找到账户信息，尝试重新创建账户 ${accountId}`);
          
          // 重新创建账户，但不强制指定ID，让数据库自动分配
          const recreatedAccount = await tx.account.create({
            data: {
              userId: flowWithAccount.userId,
              name: `恢复的账户_${accountId}`,
              type: '其他',
              balance: 0,
              currency: "CNY"
            }
          });
          
          console.log(`成功重新创建账户: ${recreatedAccount.name} (新ID=${recreatedAccount.id})`);
          
          // 更新所有使用旧账户ID的流水记录
          await tx.flow.updateMany({
            where: { accountId: accountId },
            data: { accountId: recreatedAccount.id }
          });
          
          console.log(`已更新流水记录的账户ID: ${accountId} -> ${recreatedAccount.id}`);
          
          // 使用新的账户ID继续计算余额
          const calculatedBalance = await BalanceService.calculateAccountBalance(recreatedAccount.id, tx);
          
          await tx.account.update({
            where: { id: recreatedAccount.id },
            data: { balance: calculatedBalance }
          });
          
          return; // 成功处理，退出方法
        } else {
          console.error(`账户 ${accountId} 不存在且无法从流水记录中恢复`);
          return; // 跳过这个账户的余额更新
        }
      }
      
      const calculatedBalance = await BalanceService.calculateAccountBalance(accountId, tx);
      
      await tx.account.update({
        where: { id: accountId },
        data: { balance: calculatedBalance }
      });
    } catch (error) {
      console.error('更新账户余额失败:', error);
      // 不要抛出错误，而是记录日志并继续处理其他账户
      console.warn(`跳过账户 ${accountId} 的余额更新: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 批量更新账户余额
   */
  static async updateMultipleAccountBalances(
    tx: Prisma.TransactionClient,
    accountIds: number[]
  ): Promise<void> {
    for (const accountId of accountIds) {
      await this.updateAccountBalance(tx, accountId);
    }
  }
  
  /**
   * 验证账户数据
   */
  static validateAccountData(accountName: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (!accountName || accountName.trim() === '') {
      errors.push('账户名称不能为空');
    }
    
    if (accountName && accountName.length > 50) {
      errors.push('账户名称长度不能超过50个字符');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * 获取账户统计信息
   */
  static async getAccountStats(
    tx: Prisma.TransactionClient,
    accountId: number
  ): Promise<{
    flowCount: number;
    totalIncome: number;
    totalExpense: number;
    lastTransactionDate: string | null;
  }> {
    const flows = await tx.flow.findMany({
      where: { accountId: accountId },
      orderBy: { day: 'desc' }
    });
    
    const flowCount = flows.length;
    const totalIncome = flows
      .filter((f: any) => f.flowType === '收入')
      .reduce((sum: number, f: any) => sum + (f.money || 0), 0);
    const totalExpense = flows
      .filter((f: any) => f.flowType === '支出')
      .reduce((sum: number, f: any) => sum + (f.money || 0), 0);
    const lastTransactionDate = flows.length > 0 ? flows[0].day : null;
    
    return {
      flowCount,
      totalIncome,
      totalExpense,
      lastTransactionDate
    };
  }
}
