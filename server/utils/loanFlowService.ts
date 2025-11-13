import { PrismaClient } from '@prisma/client';
import { BalanceService } from './balanceService';

const prisma = new PrismaClient();

/**
 * 借贷流水处理服务
 * 负责将借贷流水转换为转账记录，并保持余额计算的正确性
 */
export class LoanFlowService {
  
  /**
   * 借贷类型到转账方向的映射
   */
  private static readonly LOAN_TYPE_MAPPING = {
    '借入': { fromAccountField: 'relatedAccountId', toAccountField: 'accountId' },
    '借出': { fromAccountField: 'accountId', toAccountField: 'relatedAccountId' },
    '收款': { fromAccountField: 'relatedAccountId', toAccountField: 'accountId' },
    '还款': { fromAccountField: 'accountId', toAccountField: 'relatedAccountId' }
  } as const;

  /**
   * 为借贷流水创建对应的转账记录
   * @param loanFlow 借贷流水记录
   */
  static async createTransferForLoanFlow(loanFlow: any) {
    const { id, userId, bookId, day, loanType, accountId, relatedAccountId, money, name, description, attribution } = loanFlow;
    
    if (!loanType || !accountId || !relatedAccountId) {
      throw new Error(`借贷流水 ${id} 缺少必要字段: loanType=${loanType}, accountId=${accountId}, relatedAccountId=${relatedAccountId}`);
    }

    const mapping = this.LOAN_TYPE_MAPPING[loanType as keyof typeof this.LOAN_TYPE_MAPPING];
    if (!mapping) {
      throw new Error(`不支持的借贷类型: ${loanType}`);
    }

    const fromAccountId = loanFlow[mapping.fromAccountField];
    const toAccountId = loanFlow[mapping.toAccountField];

    if (!fromAccountId || !toAccountId) {
      throw new Error(`借贷流水 ${id} 缺少账户信息: fromAccountId=${fromAccountId}, toAccountId=${toAccountId}`);
    }

    const transfer = await prisma.transfer.create({
      data: {
        userId,
        fromAccountId,
        toAccountId,
        amount: money || 0,
        day,
        name: name || `${loanType}记录`,
        description: description || `${loanType}，金额¥${(money || 0).toLocaleString()}${attribution ? `，备注：${attribution}` : ''}`
      }
    });

    await prisma.flow.update({
      where: { id },
      data: { transferId: transfer.id }
    });

    await this.createTransferFlows(transfer, {
      userId,
      bookId,
      day,
      loanType,
      fromAccountId,
      toAccountId,
      amount: money || 0,
      name,
      description,
      attribution
    });

    return transfer;
  }

  /**
   * 为转账记录创建对应的流水记录
   */
  private static async createTransferFlows(transfer: any, data: any) {
    const { userId, bookId, day, loanType, fromAccountId, toAccountId, amount, name, description, attribution } = data;

    await prisma.flow.create({
      data: {
        userId,
        bookId,
        day,
        flowType: '转账',
        industryType: '转账',
        payType: '转账',
        money: amount,
        name: `从${transfer.fromAccount?.name || '账户'}转账到${transfer.toAccount?.name || '账户'}`,
        description: `${loanType}记录${description ? `，${description}` : ''}`,
        attribution: attribution || '',
        accountId: fromAccountId,
        transferId: transfer.id
      }
    });

    await prisma.flow.create({
      data: {
        userId,
        bookId,
        day,
        flowType: '转账',
        industryType: '转账',
        payType: '转账',
        money: amount,
        name: `从${transfer.fromAccount?.name || '账户'}转账到${transfer.toAccount?.name || '账户'}`,
        description: `${loanType}记录${description ? `，${description}` : ''}`,
        attribution: attribution || '',
        accountId: toAccountId,
        transferId: transfer.id
      }
    });
  }

  /**
   * 批量处理所有借贷流水，创建对应的转账记录
   * @param userId 用户ID
   */
  static async processAllLoanFlows(userId: number) {
    console.log('🔄 开始处理借贷流水数据...');

    const loanFlows = await prisma.flow.findMany({
      where: {
        userId,
        OR: [
          { flowType: { in: ['借入', '借出', '收款', '还款'] } },
          { industryType: '借贷' },
          { payType: '借贷' }
        ],
        transferId: null
      },
      orderBy: { day: 'asc' }
    });

    console.log(`📊 找到 ${loanFlows.length} 条未处理的借贷流水`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const loanFlow of loanFlows) {
      try {
        await this.createTransferForLoanFlow(loanFlow);
        successCount++;
        
        if (successCount % 50 === 0) {
          console.log(`✅ 已处理 ${successCount} 条借贷流水`);
        }
      } catch (error) {
        errorCount++;
        const errorMsg = `借贷流水 ${loanFlow.id} 处理失败: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log(`🎉 借贷流水处理完成: 成功 ${successCount} 条, 失败 ${errorCount} 条`);

    if (errors.length > 0) {
      console.log('❌ 错误详情:');
      errors.forEach(error => console.log(`  - ${error}`));
    }

    return {
      total: loanFlows.length,
      success: successCount,
      error: errorCount,
      errors
    };
  }

  /**
   * 验证借贷流水数据的一致性
   * @param userId 用户ID
   */
  static async validateLoanFlowConsistency(userId: number) {
    console.log('🔍 开始验证借贷流水数据一致性...');

    const unlinkedLoanFlows = await prisma.flow.findMany({
      where: {
        userId,
        OR: [
          { flowType: { in: ['借入', '借出', '收款', '还款'] } },
          { industryType: '借贷' },
          { payType: '借贷' }
        ],
        transferId: null
      },
      select: {
        id: true,
        flowType: true,
        loanType: true,
        accountId: true,
        relatedAccountId: true,
        money: true,
        day: true
      }
    });

    const linkedLoanFlows = await prisma.flow.findMany({
      where: {
        userId,
        OR: [
          { flowType: { in: ['借入', '借出', '收款', '还款'] } },
          { industryType: '借贷' },
          { payType: '借贷' }
        ],
        transferId: { not: null }
      },
      select: {
        id: true,
        flowType: true,
        loanType: true,
        transferId: true,
        money: true
      }
    });

    const transferIds = linkedLoanFlows.map(f => f.transferId).filter(id => id !== null);
    const existingTransfers = await prisma.transfer.findMany({
      where: { id: { in: transferIds } },
      select: { id: true }
    });
    const existingTransferIds = new Set(existingTransfers.map(t => t.id));

    const invalidTransfers = linkedLoanFlows.filter(f => 
      f.transferId && !existingTransferIds.has(f.transferId)
    );

    console.log(`📊 验证结果:`);
    console.log(`- 未关联转账的借贷流水: ${unlinkedLoanFlows.length} 条`);
    console.log(`- 已关联转账的借贷流水: ${linkedLoanFlows.length} 条`);
    console.log(`- 无效的转账关联: ${invalidTransfers.length} 条`);

    return {
      unlinkedLoanFlows,
      linkedLoanFlows,
      invalidTransfers,
      needsProcessing: unlinkedLoanFlows.length > 0 || invalidTransfers.length > 0
    };
  }

  /**
   * 重新计算所有账户余额（基于转账记录）
   * @param userId 用户ID
   */
  static async recalculateAccountBalances(userId: number) {
    console.log('🔄 开始重新计算账户余额...');

    const accounts = await prisma.account.findMany({
      where: { userId }
    });

    for (const account of accounts) {
      await BalanceService.updateAccountBalance(account.id);
    }

    console.log(`✅ 已完成 ${accounts.length} 个账户的余额重新计算`);
  }

  /**
   * 获取借贷流水的统计信息
   * @param userId 用户ID
   */
  static async getLoanFlowStatistics(userId: number) {
    const stats = await prisma.flow.groupBy({
      by: ['flowType', 'industryType', 'payType'],
      where: {
        userId,
        OR: [
          { flowType: { in: ['借入', '借出', '收款', '还款'] } },
          { industryType: '借贷' },
          { payType: '借贷' }
        ]
      },
      _count: { id: true },
      _sum: { money: true }
    });

    const totalAmount = stats.reduce((sum, stat) => sum + (stat._sum.money || 0), 0);
    const totalCount = stats.reduce((sum, stat) => sum + stat._count.id, 0);

    return {
      totalCount,
      totalAmount,
      breakdown: stats.map(stat => ({
        flowType: stat.flowType,
        industryType: stat.industryType,
        payType: stat.payType,
        count: stat._count.id,
        amount: stat._sum.money || 0
      }))
    };
  }
}
