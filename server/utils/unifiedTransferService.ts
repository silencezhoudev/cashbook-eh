import prisma from '../../lib/prisma';

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
          flowType: "支出",
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
          flowType: "收入",
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
   * 更新统一转账记录（支持借贷和转账）
   */
  static async updateTransfer(data: {
    transferId: number;
    userId: number;
    bookId: string;
    day?: string;
    transferType?: 'transfer' | 'loan';
    fromAccountId?: number;
    toAccountId?: number;
    amount?: number;
    name?: string;
    description?: string;
    loanType?: '借入' | '借出' | '收款' | '还款';
    counterparty?: string;
  }) {
    const {
      transferId,
      userId,
      bookId,
      day,
      transferType,
      fromAccountId,
      toAccountId,
      amount,
      name,
      description,
      loanType,
      counterparty
    } = data;

    // 查询原始转账记录
    console.log(`[更新转账] 开始查询转账记录: transferId=${transferId}, userId=${userId}, bookId=${bookId}`);
    
    const original = await prisma.transfer.findFirst({
      where: {
        id: transferId,
        userId
      },
      include: {
        flows: {
          where: { bookId }
        },
        fromAccount: true,
        toAccount: true
      }
    });

    if (!original) {
      // 尝试查询是否存在该转账记录（可能是userId不匹配）
      const transferExists = await prisma.transfer.findFirst({
        where: { id: transferId }
      });
      
      if (transferExists) {
        console.error(`[更新转账] 转账记录存在但userId不匹配: transferId=${transferId}, 记录userId=${transferExists.userId}, 请求userId=${userId}`);
        throw new Error("无权访问该转账记录");
      } else {
        console.error(`[更新转账] 转账记录不存在: transferId=${transferId}`);
        throw new Error("转账记录不存在");
      }
    }

    console.log(`[更新转账] 找到转账记录: transferId=${transferId}, 关联流水数=${original.flows.length}, 转出账户=${original.fromAccountId}, 转入账户=${original.toAccountId}`);

    // 检查该账本下是否有关联的流水记录
    if (original.flows.length === 0) {
      console.warn(`[更新转账] 警告: 转账记录存在但该账本下没有关联的流水记录: transferId=${transferId}, bookId=${bookId}`);
      // 不抛出错误，允许继续操作（可能是跨账本的转账）
    }

    // 计算新旧值
    const oldFromId = original.fromAccountId;
    const oldToId = original.toAccountId;
    const oldAmount = original.amount;
    const oldDay = original.day;
    const oldName = original.name || "";
    const oldDesc = original.description || "";
    const oldTransferType = original.transferType as 'transfer' | 'loan';
    const oldLoanType = original.loanType as '借入' | '借出' | '收款' | '还款' | undefined;
    const oldCounterparty = original.counterparty || "";

    const newFromId = fromAccountId !== undefined ? fromAccountId : oldFromId;
    const newToId = toAccountId !== undefined ? toAccountId : oldToId;
    const newAmount = amount !== undefined ? amount : oldAmount;
    const newDay = day !== undefined ? day : oldDay;
    const newName = name !== undefined ? name : oldName;
    const newDesc = description !== undefined ? description : oldDesc;
    const newTransferType = transferType !== undefined ? transferType : oldTransferType;
    const newLoanType = loanType !== undefined ? loanType : oldLoanType;
    const newCounterparty = counterparty !== undefined ? counterparty : oldCounterparty;

    if (newAmount <= 0) {
      throw new Error("转账金额必须大于0");
    }

    if (newFromId === newToId) {
      throw new Error("转出账户和转入账户不能相同");
    }

    // 验证借贷类型
    if (newTransferType === 'loan') {
      const validLoanTypes = ['借入', '借出', '收款', '还款'];
      if (!newLoanType || !validLoanTypes.includes(newLoanType)) {
        throw new Error(`借贷类型必须是以下之一: ${validLoanTypes.join(', ')}`);
      }
      if (!newCounterparty) {
        throw new Error("借贷对象不能为空");
      }
    }

    // 验证账户有效性
    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findFirst({ where: { id: newFromId, userId } }),
      prisma.account.findFirst({ where: { id: newToId, userId } })
    ]);

    if (!fromAccount || !toAccount) {
      throw new Error("账户不存在或已禁用");
    }

    return await prisma.$transaction(async (tx) => {
      // 1) 查询所有关联的流水记录（包括所有账本的）
      const relatedFlows = await tx.flow.findMany({
        where: { transferId: original.id }
      });

      console.log(`[更新转账] 查询到 ${relatedFlows.length} 条关联流水记录（所有账本）`);

      // 2) 删除所有关联的流水记录
      const deletedFlows = await tx.flow.deleteMany({
        where: { transferId: original.id }
      });

      console.log(`[更新转账] 删除了 ${deletedFlows.count} 条关联流水记录`);

      // 3) 回滚旧余额影响
      await tx.account.update({
        where: { id: oldFromId },
        data: { balance: { increment: oldAmount } }
      });

      await tx.account.update({
        where: { id: oldToId },
        data: { balance: { decrement: oldAmount } }
      });

      // 4) 删除旧的 transfer
      await tx.transfer.delete({
        where: { id: original.id }
      });

      // 5) 创建新的 transfer
      const createdTransfer = await tx.transfer.create({
        data: {
          userId,
          fromAccountId: newFromId,
          toAccountId: newToId,
          amount: newAmount,
          day: newDay,
          name: newName || this.generateTransferName(newTransferType, newLoanType, newCounterparty),
          description: newDesc || undefined,
          transferType: newTransferType,
          loanType: newLoanType || undefined,
          counterparty: newCounterparty || undefined
        }
      });

      // 6) 创建新的两条流水（使用与创建时相同的格式）
      const flowName = this.generateFlowName(newTransferType, newLoanType, fromAccount.name, toAccount.name, newCounterparty);
      const flowDescription = this.generateFlowDescription(newTransferType, newLoanType, newCounterparty, newDesc);
      const flowAttribution = newTransferType === 'loan' ? '借贷' : '转账';
      const displayFlowType = newTransferType === 'loan' ? '借贷' : '转账';
      const displayIndustryType = this.getDisplayIndustryType(newTransferType, newLoanType);

      // 使用与创建时相同的 flowType: "转账"（而不是"支出"/"收入"）
      await tx.flow.create({
        data: {
          userId,
          bookId,
          day: newDay,
          flowType: "转账",
          industryType: "转账",
          payType: "转账",
          money: newAmount,
          name: flowName,
          description: flowDescription,
          attribution: flowAttribution,
          accountId: newFromId,
          transferId: createdTransfer.id,
          displayFlowType,
          displayIndustryType
        }
      });

      await tx.flow.create({
        data: {
          userId,
          bookId,
          day: newDay,
          flowType: "转账",
          industryType: "转账",
          payType: "转账",
          money: newAmount,
          name: flowName,
          description: flowDescription,
          attribution: flowAttribution,
          accountId: newToId,
          transferId: createdTransfer.id,
          displayFlowType,
          displayIndustryType
        }
      });

      console.log(`[更新转账] 已创建新的转账流水: 转出账户=${newFromId}, 转入账户=${newToId}, 金额=${newAmount}`);

      // 7) 应用新余额影响
      await tx.account.update({
        where: { id: newFromId },
        data: { balance: { decrement: newAmount } }
      });

      await tx.account.update({
        where: { id: newToId },
        data: { balance: { increment: newAmount } }
      });

      return { transfer: createdTransfer };
    });
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

    console.log(`[删除转账] 开始删除转账记录 ID=${transferId}, 关联流水数=${transfer.flows.length}`);

    return await prisma.$transaction(async (tx) => {
      // 1. 先查询所有关联的流水记录（包括可能存在的所有类型）
      const relatedFlows = await tx.flow.findMany({
        where: { transferId }
      });

      console.log(`[删除转账] 查询到 ${relatedFlows.length} 条关联流水记录:`, 
        relatedFlows.map(f => ({ id: f.id, flowType: f.flowType, industryType: f.industryType, accountId: f.accountId })));

      // 2. 删除所有关联的流水记录
      const deleteResult = await tx.flow.deleteMany({
        where: { transferId }
      });

      console.log(`[删除转账] 实际删除了 ${deleteResult.count} 条流水记录`);

      // 验证删除是否完整
      if (deleteResult.count !== relatedFlows.length) {
        console.warn(`[删除转账] 警告: 期望删除 ${relatedFlows.length} 条流水，实际删除了 ${deleteResult.count} 条`);
      }

      // 3. 恢复账户余额
      await tx.account.update({
        where: { id: transfer.fromAccountId },
        data: { balance: { increment: transfer.amount } }
      });

      await tx.account.update({
        where: { id: transfer.toAccountId },
        data: { balance: { decrement: transfer.amount } }
      });

      console.log(`[删除转账] 已恢复账户余额: 转出账户 ${transfer.fromAccountId} +${transfer.amount}, 转入账户 ${transfer.toAccountId} -${transfer.amount}`);

      // 4. 删除转账记录
      await tx.transfer.delete({
        where: { id: transferId }
      });

      console.log(`[删除转账] 转账记录删除成功 ID=${transferId}`);

      // 5. 验证是否还有残留的流水记录
      const remainingFlows = await tx.flow.findMany({
        where: { transferId }
      });

      if (remainingFlows.length > 0) {
        console.error(`[删除转账] 错误: 删除后仍有 ${remainingFlows.length} 条残留流水记录:`, 
          remainingFlows.map(f => ({ id: f.id, flowType: f.flowType, industryType: f.industryType })));
        // 强制删除残留的流水记录
        await tx.flow.deleteMany({
          where: { transferId }
        });
        console.log(`[删除转账] 已强制删除残留的流水记录`);
      }

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
