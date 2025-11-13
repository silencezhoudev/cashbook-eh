import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 统一转账服务 - 处理借贷和转账的统一逻辑
 */
export class UnifiedTransferService {
  static readonly TRANSFER_TYPES = {
    TRANSFER: 'transfer',
    LOAN: 'loan'
  } as const;

  static readonly LOAN_TYPES = {
    BORROW: '借入',
    LEND: '借出', 
    RECEIVE: '收款',
    REPAY: '还款'
  } as const;

  /**
   * 创建统一转账记录（支持借贷和转账）
   */
  static async createTransfer(data: {
    userId: number;
    bookId: string;
    day: string;
    transferType: 'transfer' | 'loan';
    fromAccountId: number;
    toAccountId: number;
    amount: number;
    name?: string;
    description?: string;
    loanType?: '借入' | '借出' | '收款' | '还款';
    counterparty?: string;
  }) {
    const { 
      userId, bookId, day, transferType, fromAccountId, toAccountId, amount, 
      name, description, loanType, counterparty 
    } = data;

    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findFirst({
        where: { id: fromAccountId, userId }
      }),
      prisma.account.findFirst({
        where: { id: toAccountId, userId }
      })
    ]);

    if (!fromAccount || !toAccount) {
      throw new Error("账户不存在或已禁用");
    }

    if (fromAccountId === toAccountId) {
      throw new Error("转出账户和转入账户不能相同");
    }

    return await prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          userId,
          fromAccountId,
          toAccountId,
          amount,
          day,
          name: name || this.generateTransferName(transferType, loanType, counterparty),
          description,
          transferType,
          loanType,
          counterparty
        }
      });

      const outFlow = await tx.flow.create({
        data: {
          userId,
          bookId,
          day,
          flowType: "转账",
          industryType: "转账",
          payType: "转账",
          money: amount,
          name: this.generateFlowName(transferType, loanType, fromAccount.name, toAccount.name, counterparty),
          description: this.generateFlowDescription(transferType, loanType, counterparty, description),
          attribution: transferType === 'loan' ? '借贷' : '转账',
          accountId: fromAccountId,
          transferId: transfer.id,
          displayFlowType: transferType === 'loan' ? '借贷' : '转账',
          displayIndustryType: this.getDisplayIndustryType(transferType, loanType)
        }
      });

      const inFlow = await tx.flow.create({
        data: {
          userId,
          bookId,
          day,
          flowType: "转账",
          industryType: "转账",
          payType: "转账",
          money: amount,
          name: this.generateFlowName(transferType, loanType, fromAccount.name, toAccount.name, counterparty),
          description: this.generateFlowDescription(transferType, loanType, counterparty, description),
          attribution: transferType === 'loan' ? '借贷' : '转账',
          accountId: toAccountId,
          transferId: transfer.id,
          displayFlowType: transferType === 'loan' ? '借贷' : '转账',
          displayIndustryType: this.getDisplayIndustryType(transferType, loanType)
        }
      });

      await tx.account.update({
        where: { id: fromAccountId },
        data: { balance: { decrement: amount } }
      });

      await tx.account.update({
        where: { id: toAccountId },
        data: { balance: { increment: amount } }
      });

      return { transfer, outFlow, inFlow };
    });
  }

  /**
   * 生成转账记录名称
   */
  private static generateTransferName(
    transferType: string, 
    loanType?: string, 
    counterparty?: string
  ): string {
    if (transferType === 'loan' && loanType && counterparty) {
      return `${loanType}-${counterparty}`;
    }
    return '账户转账';
  }

  /**
   * 生成流水名称
   */
  private static generateFlowName(
    transferType: string,
    loanType?: string,
    fromAccountName?: string,
    toAccountName?: string,
    counterparty?: string
  ): string {
    if (transferType === 'loan' && loanType && counterparty) {
      return `${loanType}给${counterparty}`;
    }
    return `从${fromAccountName}转账到${toAccountName}`;
  }

  /**
   * 生成流水描述
   */
  private static generateFlowDescription(
    transferType: string,
    loanType?: string,
    counterparty?: string,
    description?: string
  ): string {
    if (transferType === 'loan' && loanType && counterparty) {
      return `${loanType}给${counterparty}${description ? `，${description}` : ''}`;
    }
    return description || '';
  }

  /**
   * 获取显示用的支出/收入类型
   */
  private static getDisplayIndustryType(
    transferType: string,
    loanType?: string
  ): string {
    if (transferType === 'loan' && loanType) {
      return loanType;
    }
    return '转账';
  }

  /**
   * 删除转账记录（支持借贷和转账）
   */
  static async deleteTransfer(transferId: number, userId: number) {
    const transfer = await prisma.transfer.findFirst({
      where: { id: transferId, userId },
      include: { flows: true }
    });

    if (!transfer) {
      throw new Error("转账记录不存在");
    }

    return await prisma.$transaction(async (tx) => {
      await tx.flow.deleteMany({
        where: { transferId }
      });

      await tx.account.update({
        where: { id: transfer.fromAccountId },
        data: { balance: { increment: transfer.amount } }
      });

      await tx.account.update({
        where: { id: transfer.toAccountId },
        data: { balance: { decrement: transfer.amount } }
      });

      await tx.transfer.delete({
        where: { id: transferId }
      });

      return { message: "转账记录删除成功" };
    });
  }

  /**
   * 获取转账记录列表
   */
  static async getTransferList(params: {
    userId: number;
    bookId?: string;
    transferType?: 'transfer' | 'loan';
    startDay?: string;
    endDay?: string;
    pageNum?: number;
    pageSize?: number;
  }) {
    const { userId, bookId, transferType, startDay, endDay, pageNum = 1, pageSize = 100 } = params;

    const where: any = { userId };

    if (transferType) {
      where.transferType = transferType;
    }

    if (startDay && endDay) {
      where.day = { gte: startDay, lte: endDay };
    } else if (startDay) {
      where.day = { gte: startDay };
    } else if (endDay) {
      where.day = { lte: endDay };
    }

    const skip = (pageNum - 1) * pageSize;

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        include: {
          fromAccount: { select: { id: true, name: true, type: true } },
          toAccount: { select: { id: true, name: true, type: true } },
          flows: {
            where: { bookId: bookId },
            select: { id: true, displayFlowType: true, displayIndustryType: true }
          }
        },
        orderBy: { createDate: "desc" },
        skip,
        take: pageSize
      }),
      prisma.transfer.count({ where })
    ]);

    return {
      data: transfers,
      total,
      pageNum,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }
}
