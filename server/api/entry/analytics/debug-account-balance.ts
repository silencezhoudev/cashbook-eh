import { defineEventHandler, readBody } from 'h3';
import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/analytics/debug-account-balance:
 *   post:
 *     summary: 调试账户余额计算
 *     tags: ["Analytics"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *     responses:
 *       200:
 *         description: 调试数据获取成功
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const userId = await getUserId(event);
  
  if (!body.bookId) {
    return error("请先选择账本");
  }

  // 获取所有账户（不考虑状态和是否计入总资产）
  const accounts = await prisma.account.findMany({
    where: {
      userId: userId
    },
    orderBy: { createDate: 'asc' }
  });

  // 计算当前总资产（所有账户之和）
  const currentTotalBalance = accounts.reduce((sum: number, acc: { balance: number | null }) => sum + (acc.balance || 0), 0);

  // 获取所有账本的所有流水记录（不限制账本）
  // 与账户余额计算保持一致：不处理eliminate字段，但排除transferId不为null的记录
  const flows = await prisma.flow.findMany({
    where: {
      userId: userId,
      accountId: {
        in: accounts.map((acc: { id: number }) => acc.id)
      },
      transferId: null  // 排除由转账生成的流水记录，避免重复计算
    },
    orderBy: { day: 'asc' }
  });

  // 计算通过流水得出的总余额
  const accountBalances: { [key: number]: number } = {};
  accounts.forEach((account: { id: number }) => {
    accountBalances[account.id] = 0; // 从0开始
  });

  flows.forEach((flow: any) => {
    const accountId = flow.accountId!;
    const money = flow.money || 0;
    const flowType = flow.flowType;
    
    // 根据流水类型判断对账户余额的影响
    if (flowType && ["收入", "借入", "收款"].includes(flowType)) {
      // 这些类型使账户余额增加
      accountBalances[accountId] += money;
    } else if (flowType && ["支出", "借出", "还款"].includes(flowType)) {
      // 这些类型使账户余额减少
      accountBalances[accountId] -= money;
    }
    // 转账类型在流水表中不会出现，因为转账是通过 transfer 表处理的
  });

  const flowCalculatedTotal = Object.values(accountBalances).reduce((sum: number, balance: number) => sum + balance, 0);

  // 计算账户管理页面的总资产（只计算计入总资产的账户）
  const accountManagementTotal = accounts
    .filter((acc: { includeInTotal: boolean | null | undefined }) => acc.includeInTotal !== false)
    .reduce((sum: number, acc: { balance: number | null }) => sum + (acc.balance || 0), 0);

  return success({
    // 所有账户的总资产
    allAccountsTotal: currentTotalBalance,
    // 账户管理页面的总资产（只计算计入总资产的账户）
    accountManagementTotal: accountManagementTotal,
    // 通过流水计算的总资产
    flowCalculatedTotal: flowCalculatedTotal,
    accountCount: accounts.length,
    flowCount: flows.length,
    // 所有账户的详细信息
    allAccounts: accounts.map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      balance: acc.balance,
      calculatedBalance: accountBalances[acc.id],
      includeInTotal: acc.includeInTotal,
      type: acc.type,
      createDate: acc.createDate
    })),
    // 计入总资产的账户
    includedAccounts: accounts
      .filter((acc: any) => acc.includeInTotal !== false)
      .map((acc: any) => ({
        id: acc.id,
        name: acc.name,
        balance: acc.balance,
        calculatedBalance: accountBalances[acc.id],
        includeInTotal: acc.includeInTotal
      })),
    // 不计入总资产的账户
    excludedAccounts: accounts
      .filter((acc: any) => acc.includeInTotal === false)
      .map((acc: any) => ({
        id: acc.id,
        name: acc.name,
        balance: acc.balance,
        calculatedBalance: accountBalances[acc.id],
        includeInTotal: acc.includeInTotal
      }))
  });
});
