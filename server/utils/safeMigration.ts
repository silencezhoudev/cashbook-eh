import prisma from "~/lib/prisma";

/**
 * 安全的数据迁移工具，为历史数据创建默认账户并处理关联
 */
export class SafeMigration {
  /**
   * 为每个账本创建默认账户
   */
  static async createDefaultAccounts(): Promise<{
    success: boolean;
    message: string;
    stats: any;
  }> {
    try {
      console.log("开始创建默认账户...");
      
      const stats = {
        totalBooks: 0,
        accountsCreated: 0,
        accountsSkipped: 0
      };

      const books = await prisma.book.findMany({
        select: { bookId: true, userId: true, bookName: true }
      });
      
      stats.totalBooks = books.length;

      for (const book of books) {
        const existingAccount = await prisma.account.findFirst({
          where: {
            bookId: book.bookId,
            name: "默认账户"
          }
        });
        
        if (!existingAccount) {
          await prisma.account.create({
            data: {
              bookId: book.bookId,
              userId: book.userId,
              name: "默认账户",
              type: "现金",
              balance: 0,
              currency: "CNY"
            }
          });
          stats.accountsCreated++;
          console.log(`为账本 ${book.bookName} 创建默认账户`);
        } else {
          stats.accountsSkipped++;
        }
      }
      
      console.log("默认账户创建完成:", stats);
      
      return {
        success: true,
        message: "默认账户创建成功",
        stats
      };
      
    } catch (error: unknown) {
      console.error("创建默认账户失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `创建默认账户失败: ${errorMessage}`,
        stats: null
      };
    }
  }

  /**
   * 将历史流水关联到默认账户
   */
  static async linkFlowsToDefaultAccounts(): Promise<{
    success: boolean;
    message: string;
    stats: any;
  }> {
    try {
      console.log("开始关联历史流水到默认账户...");
      
      const stats = {
        totalFlows: 0,
        flowsUpdated: 0,
        flowsSkipped: 0
      };

      const flowsWithoutAccount = await prisma.flow.findMany({
        where: { accountId: null },
        select: { id: true, bookId: true }
      });
      
      stats.totalFlows = flowsWithoutAccount.length;

      for (const flow of flowsWithoutAccount) {
        const defaultAccount = await prisma.account.findFirst({
          where: {
            bookId: flow.bookId,
            name: "默认账户"
          }
        });
        
        if (defaultAccount) {
          await prisma.flow.update({
            where: { id: flow.id },
            data: { accountId: defaultAccount.id }
          });
          stats.flowsUpdated++;
        } else {
          stats.flowsSkipped++;
        }
      }
      
      console.log("历史流水关联完成:", stats);
      
      return {
        success: true,
        message: "历史流水关联成功",
        stats
      };
      
    } catch (error: unknown) {
      console.error("关联历史流水失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `关联历史流水失败: ${errorMessage}`,
        stats: null
      };
    }
  }

  /**
   * 计算并更新所有账户余额
   */
  static async calculateAccountBalances(): Promise<{
    success: boolean;
    message: string;
    stats: any;
  }> {
    try {
      console.log("开始计算账户余额...");
      
      const stats = {
        totalAccounts: 0,
        accountsUpdated: 0,
        errors: 0
      };

      const accounts = await prisma.account.findMany();
      stats.totalAccounts = accounts.length;

      for (const account of accounts) {
        try {
          const incomeSum = await prisma.flow.aggregate({
            where: {
              accountId: account.id,
              flowType: "收入"
            },
            _sum: { money: true }
          });
          
          const expenseSum = await prisma.flow.aggregate({
            where: {
              accountId: account.id,
              flowType: "支出"
            },
            _sum: { money: true }
          });
          
          const transferInSum = await prisma.transfer.aggregate({
            where: { toAccountId: account.id },
            _sum: { amount: true }
          });
          
          const transferOutSum = await prisma.transfer.aggregate({
            where: { fromAccountId: account.id },
            _sum: { amount: true }
          });
          
          const calculatedBalance = 
            (incomeSum._sum.money || 0) - 
            (expenseSum._sum.money || 0) + 
            (transferInSum._sum.amount || 0) - 
            (transferOutSum._sum.amount || 0);
          
          await prisma.account.update({
            where: { id: account.id },
            data: { balance: calculatedBalance }
          });
          
          stats.accountsUpdated++;
          console.log(`账户 ${account.name} 余额更新为: ${calculatedBalance}`);
          
        } catch (error: unknown) {
          stats.errors++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`计算账户 ${account.name} 余额失败:`, error);
        }
      }
      
      console.log("账户余额计算完成:", stats);
      
      return {
        success: true,
        message: "账户余额计算成功",
        stats
      };
      
    } catch (error: unknown) {
      console.error("计算账户余额失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `计算账户余额失败: ${errorMessage}`,
        stats: null
      };
    }
  }

  /**
   * 执行完整的数据迁移
   */
  static async executeFullMigration(): Promise<{
    success: boolean;
    message: string;
    results: any[];
  }> {
    try {
      console.log("开始执行完整数据迁移...");
      
      const results = [];
      
      // 1. 创建默认账户
      const accountResult = await this.createDefaultAccounts();
      results.push({ step: "创建默认账户", ...accountResult });
      
      if (!accountResult.success) {
        throw new Error("创建默认账户失败");
      }
      
      // 2. 关联历史流水
      const linkResult = await this.linkFlowsToDefaultAccounts();
      results.push({ step: "关联历史流水", ...linkResult });
      
      if (!linkResult.success) {
        throw new Error("关联历史流水失败");
      }
      
      // 3. 计算账户余额
      const balanceResult = await this.calculateAccountBalances();
      results.push({ step: "计算账户余额", ...balanceResult });
      
      if (!balanceResult.success) {
        throw new Error("计算账户余额失败");
      }
      
      console.log("完整数据迁移成功完成");
      
      return {
        success: true,
        message: "数据迁移成功完成",
        results
      };
      
    } catch (error: unknown) {
      console.error("完整数据迁移失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `数据迁移失败: ${errorMessage}`,
        results: []
      };
    }
  }
}
