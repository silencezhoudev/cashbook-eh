import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 借贷服务 - 统一处理借贷逻辑
 */
export class LoanService {
  static readonly LOAN_TYPES = {
    BORROW: '借入',
    LEND: '借出', 
    RECEIVE: '收款',
    REPAY: '还款'
  } as const;

  /**
   * 创建借贷记录
   * @param data 借贷数据
   */
  static async createLoanRecord(data: {
    userId: number;
    bookId: string;
    day: string;
    loanType: '借入' | '借出' | '收款' | '还款';
    fromAccountId: number;
    toAccountId: number;
    amount: number;
    counterparty: string;
    description?: string;
    attribution?: string;
  }) {
    const { userId, bookId, day, loanType, fromAccountId, toAccountId, amount, counterparty, description, attribution } = data;

    const transfer = await prisma.transfer.create({
      data: {
        userId,
        fromAccountId,
        toAccountId,
        amount,
        day,
        name: `${loanType}-${counterparty}`,
        description: `${loanType}给${counterparty}，金额¥${amount.toLocaleString()}${description ? `，备注：${description}` : ''}`
      }
    });

    await this.createTransferFlows(transfer, {
      userId,
      bookId,
      day,
      loanType,
      fromAccountId,
      toAccountId,
      amount,
      counterparty,
      description,
      attribution
    });

    return transfer;
  }

  /**
   * 为转账记录创建关联的流水记录
   */
  private static async createTransferFlows(transfer: any, data: any) {
    const { userId, bookId, day, loanType, fromAccountId, toAccountId, amount, counterparty, description, attribution } = data;

    await prisma.flow.create({
      data: {
        userId,
        bookId,
        day,
        flowType: '转账',
        industryType: '转账',
        payType: '转账',
        money: amount,
        name: `从${transfer.fromAccount.name}转账到${transfer.toAccount.name}`,
        description: `${loanType}给${counterparty}${description ? `，${description}` : ''}`,
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
        name: `从${transfer.fromAccount.name}转账到${transfer.toAccount.name}`,
        description: `${loanType}给${counterparty}${description ? `，${description}` : ''}`,
        attribution: attribution || '',
        accountId: toAccountId,
        transferId: transfer.id
      }
    });
  }

  /**
   * 合并重复的借贷记录
   * @param userId 用户ID
   */
  static async consolidateDuplicateLoanRecords(userId: number) {
    const loanFlows = await prisma.flow.findMany({
      where: {
        userId,
        OR: [
          { flowType: { in: ['借入', '借出', '收款', '还款'] } },
          { industryType: '借贷' },
          { payType: '借贷' }
        ]
      },
      include: {
        account: true
      },
      orderBy: { day: 'asc' }
    });

    const flowGroups: { [key: string]: any[] } = {};
    loanFlows.forEach(flow => {
      const key = `${flow.day}_${flow.money}_${flow.name}_${flow.description || ''}`;
      if (!flowGroups[key]) flowGroups[key] = [];
      flowGroups[key].push(flow);
    });

    const duplicateGroups = Object.entries(flowGroups).filter(([key, flows]) => flows.length > 1);
    
    let totalMerged = 0;
    let createdTransfers = 0;

    for (const [key, flows] of duplicateGroups) {
      const loanType = this.analyzeLoanType(flows);
      if (!loanType) continue;

      const transfer = await this.createLoanRecord({
        userId,
        bookId: flows[0].bookId,
        day: flows[0].day,
        loanType: loanType.type,
        fromAccountId: loanType.fromAccount.id,
        toAccountId: loanType.toAccount.id,
        amount: loanType.amount,
        counterparty: loanType.counterparty,
        description: loanType.description,
        attribution: flows[0].attribution
      });

      if (transfer) {
        for (const flow of flows) {
          await prisma.flow.delete({
            where: { id: flow.id }
          });
        }

        totalMerged += flows.length;
        createdTransfers++;
      }
    }

    return { totalMerged, createdTransfers };
  }

  /**
   * 分析借贷类型
   */
  private static analyzeLoanType(flows: any[]) {
    const flowTypes = flows.map(f => f.flowType);

    if (flowTypes.includes('支出') && flowTypes.includes('收款')) {
      const expenseFlow = flows.find(f => f.flowType === '支出');
      const receiveFlow = flows.find(f => f.flowType === '收款');
      
      return {
        type: '收款' as const,
        fromAccount: receiveFlow?.account,
        toAccount: expenseFlow?.account,
        amount: expenseFlow?.money || 0,
        counterparty: this.extractCounterparty(expenseFlow?.name || ''),
        description: expenseFlow?.description || ''
      };
    }

    if (flowTypes.includes('支出') && flowTypes.includes('借出')) {
      const expenseFlow = flows.find(f => f.flowType === '支出');
      const lendFlow = flows.find(f => f.flowType === '借出');
      
      return {
        type: '借出' as const,
        fromAccount: expenseFlow?.account,
        toAccount: lendFlow?.account,
        amount: expenseFlow?.money || 0,
        counterparty: this.extractCounterparty(expenseFlow?.name || ''),
        description: expenseFlow?.description || ''
      };
    }

    if (flowTypes.includes('借入') && flowTypes.includes('收入')) {
      const borrowFlow = flows.find(f => f.flowType === '借入');
      const incomeFlow = flows.find(f => f.flowType === '收入');
      
      return {
        type: '借入' as const,
        fromAccount: borrowFlow?.account,
        toAccount: incomeFlow?.account,
        amount: incomeFlow?.money || 0,
        counterparty: this.extractCounterparty(incomeFlow?.name || ''),
        description: incomeFlow?.description || ''
      };
    }

    if (flowTypes.includes('还款') && flowTypes.includes('支出')) {
      const repayFlow = flows.find(f => f.flowType === '还款');
      const expenseFlow = flows.find(f => f.flowType === '支出');
      
      return {
        type: '还款' as const,
        fromAccount: expenseFlow?.account,
        toAccount: repayFlow?.account,
        amount: expenseFlow?.money || 0,
        counterparty: this.extractCounterparty(expenseFlow?.name || ''),
        description: expenseFlow?.description || ''
      };
    }

    return null;
  }

  /**
   * 提取借贷对象名称
   */
  private static extractCounterparty(name: string): string {
    if (name.includes('朋友')) return '朋友';
    if (name.includes('宝哥')) return '宝哥';
    if (name.includes('皎')) return '皎皎';
    if (name.includes('马丹')) return '马丹';
    return '未知';
  }

  /**
   * 验证数据一致性
   * @param userId 用户ID
   */
  static async validateLoanDataConsistency(userId: number) {
    const remainingLoanFlows = await prisma.flow.findMany({
      where: {
        userId,
        OR: [
          { flowType: { in: ['借入', '借出', '收款', '还款'] } },
          { industryType: '借贷' },
          { payType: '借贷' }
        ]
      }
    });

    return {
      hasDuplicateRecords: remainingLoanFlows.length > 0,
      duplicateCount: remainingLoanFlows.length,
      records: remainingLoanFlows
    };
  }
}