import prisma from "~/lib/prisma";
import type { Prisma } from "@prisma/client";
import { AccountImportService } from "./accountImportService";

/**
 * 余额计算服务
 * 提供账户余额的实时计算和验证功能
 */
export class BalanceService {
  /**
   * 计算单个账户的实时余额
   */
  static async calculateAccountBalance(
    accountId: number, 
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || prisma;
    
    const account = await client.account.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      console.warn(`账户 ${accountId} 不存在，尝试从流水记录中恢复账户信息`);
      
      // 尝试从流水记录中找到账户信息
      const flowWithAccount = await client.flow.findFirst({
        where: { accountId: accountId }
      });
      
      if (flowWithAccount) {
        console.log(`从流水记录中找到账户信息，尝试重新创建账户 ${accountId}`);
        
        // 重新创建账户，但不强制指定ID，让数据库自动分配
        const recreatedAccount = await client.account.create({
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
        await client.flow.updateMany({
          where: { accountId: accountId },
          data: { accountId: recreatedAccount.id }
        });
        
        console.log(`已更新流水记录的账户ID: ${accountId} -> ${recreatedAccount.id}`);
        
        // 使用新的账户ID继续计算
        return this.calculateAccountBalance(recreatedAccount.id, tx);
      } else {
        throw new Error(`账户 ${accountId} 不存在且无法从流水记录中恢复`);
      }
    }
    
    // 计算收入总额（只计算真正的收入，借贷应该通过转账记录处理）
    const incomeSum = await client.flow.aggregate({
      where: {
        accountId: accountId,
        flowType: { in: ["收入"] } as any,
        // 排除由转账生成的账户级流水，避免与 Transfer 汇总重复计算
        transferId: null as any
      },
      _sum: { money: true }
    });
    
    // 计算支出总额（只计算真正的支出，借贷应该通过转账记录处理）
    const expenseSum = await client.flow.aggregate({
      where: {
        accountId: accountId,
        flowType: { in: ["支出"] } as any,
        // 排除由转账生成的账户级流水，避免与 Transfer 汇总重复计算
        transferId: null as any
      },
      _sum: { money: true }
    });

    // 处理借贷流水（按转账方式计算余额）
    const loanFlows = await client.flow.findMany({
      where: {
        accountId: accountId,
        OR: [
          { flowType: { in: ["借入", "借出", "收款", "还款"] } as any },
          { industryType: "借贷" as any },
          { payType: "借贷" as any }
        ],
        transferId: null as any
      }
    });

    // 如果有未关联转账的借贷流水，按借贷类型计算余额影响
    let loanBalanceImpact = 0;
    for (const loanFlow of loanFlows) {
      const money = loanFlow.money || 0;
      const loanType = loanFlow.loanType || loanFlow.industryType;
      
      // 根据借贷类型计算对当前账户余额的影响
      if (loanType && ['借入', '收款'].includes(loanType)) {
        // 借入和收款：资金流入当前账户
        loanBalanceImpact += money;
      } else if (loanType && ['借出', '还款'].includes(loanType)) {
        // 借出和还款：资金流出当前账户
        loanBalanceImpact -= money;
      }
    }

    if (loanFlows.length > 0) {
      console.warn(`账户 ${accountId} 有 ${loanFlows.length} 条未关联转账的借贷流水，按借贷类型计算余额影响: ${loanBalanceImpact}`);
    }
    
    // 计算转入总额
    const transferInSum = await client.transfer.aggregate({
      where: { toAccountId: accountId },
      _sum: { amount: true }
    });
    
    // 计算转出总额
    const transferOutSum = await client.transfer.aggregate({
      where: { fromAccountId: accountId },
      _sum: { amount: true }
    });
    
    return (
      (incomeSum._sum.money || 0) -
      (expenseSum._sum.money || 0) +
      (transferInSum._sum.amount || 0) -
      (transferOutSum._sum.amount || 0) +
      loanBalanceImpact
    );
  }

  /**
   * 计算单个账户在指定账本中的余额变化
   * 用于删除账本时计算需要恢复的余额
   */
  static async calculateAccountBalanceInBook(
    accountId: number,
    bookId: string,
    userId: number,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || prisma;
    
    // 计算该账本中该账户的收入总额（只计算真正的收入，借贷应该通过转账记录处理）
    const incomeSum = await client.flow.aggregate({
      where: {
        accountId: accountId,
        bookId: bookId,
        userId: userId,
        flowType: { in: ["收入"] } as any,
        // 排除由转账生成的账户级流水，避免与 Transfer 汇总重复计算
        transferId: null as any
      },
      _sum: { money: true }
    });
    
    // 计算该账本中该账户的支出总额（只计算真正的支出，借贷应该通过转账记录处理）
    const expenseSum = await client.flow.aggregate({
      where: {
        accountId: accountId,
        bookId: bookId,
        userId: userId,
        flowType: { in: ["支出"] } as any,
        // 排除由转账生成的账户级流水，避免与 Transfer 汇总重复计算
        transferId: null as any
      },
      _sum: { money: true }
    });
    
    // 计算该账本中涉及该账户的转账记录
    // 先获取该账本中所有转账ID
    const bookTransfers = await client.flow.findMany({
      where: {
        bookId: bookId,
        userId: userId,
        transferId: { not: null }
      },
      select: { transferId: true }
    });
    
    const transferIds = bookTransfers
      .map((f: any) => f.transferId)
      .filter((id: any): id is number => id !== null);
    
    let transferInSum = 0;
    let transferOutSum = 0;
    
    if (transferIds.length > 0) {
      // 计算转入总额（该账户作为接收方）
      const transferInResult = await client.transfer.aggregate({
        where: { 
          id: { in: transferIds },
          toAccountId: accountId 
        },
        _sum: { amount: true }
      });
      transferInSum = transferInResult._sum.amount || 0;
      
      // 计算转出总额（该账户作为发送方）
      const transferOutResult = await client.transfer.aggregate({
        where: { 
          id: { in: transferIds },
          fromAccountId: accountId 
        },
        _sum: { amount: true }
      });
      transferOutSum = transferOutResult._sum.amount || 0;
    }
    
    // 处理该账本中的借贷流水
    const bookLoanFlows = await client.flow.findMany({
      where: {
        accountId: accountId,
        bookId: bookId,
        userId: userId,
        OR: [
          { flowType: { in: ["借入", "借出", "收款", "还款"] } as any },
          { industryType: "借贷" as any },
          { payType: "借贷" as any }
        ],
        transferId: null as any
      }
    });

    let bookLoanBalanceImpact = 0;
    for (const loanFlow of bookLoanFlows) {
      const money = loanFlow.money || 0;
      const loanType = loanFlow.loanType || loanFlow.industryType;
      
      if (loanType && ['借入', '收款'].includes(loanType)) {
        bookLoanBalanceImpact += money;
      } else if (loanType && ['借出', '还款'].includes(loanType)) {
        bookLoanBalanceImpact -= money;
      }
    }
    
    return (
      (incomeSum._sum.money || 0) -
      (expenseSum._sum.money || 0) +
      transferInSum -
      transferOutSum +
      bookLoanBalanceImpact
    );
  }
  
  /**
   * 更新账户余额
   */
  static async updateAccountBalance(
    accountId: number, 
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx || prisma;
    const calculatedBalance = await this.calculateAccountBalance(accountId, tx);
    
    await client.account.update({
      where: { id: accountId },
      data: { balance: calculatedBalance }
    });
  }

  /**
   * 恢复账户余额（删除账本时使用）
   * 从当前余额中减去指定账本对该账户的影响
   */
  static async restoreAccountBalanceAfterBookDeletion(
    accountId: number,
    bookId: string,
    userId: number,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx || prisma;
    
    // 获取当前账户余额
    const account = await client.account.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      console.warn(`账户 ${accountId} 不存在，跳过余额恢复`);
      return;
    }
    
    // 计算该账本对该账户的余额影响
    const bookBalanceImpact = await this.calculateAccountBalanceInBook(
      accountId, 
      bookId, 
      userId, 
      tx
    );
    
    // 从当前余额中减去该账本的影响
    const newBalance = account.balance - bookBalanceImpact;
    
    console.log(`账户 ${accountId} 余额恢复: ${account.balance} - ${bookBalanceImpact} = ${newBalance}`);
    
    await client.account.update({
      where: { id: accountId },
      data: { balance: newBalance }
    });
  }
  
  /**
   * 批量更新所有账户余额
   */
  static async updateAllAccountBalances(): Promise<void> {
    const accounts = await prisma.account.findMany();
    
    for (const account of accounts) {
      await this.updateAccountBalance(account.id);
    }
  }
  
  /**
   * 验证账户余额一致性
   */
  static async validateAccountBalance(accountId: number): Promise<{
    isValid: boolean;
    storedBalance: number;
    calculatedBalance: number;
    difference: number;
  }> {
    const account = await prisma.account.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      throw new Error("账户不存在");
    }
    
    const calculatedBalance = await this.calculateAccountBalance(accountId);
    const difference = Math.abs(account.balance - calculatedBalance);
    
    return {
      isValid: difference < 0.01, // 允许0.01的误差
      storedBalance: account.balance,
      calculatedBalance,
      difference
    };
  }
}
