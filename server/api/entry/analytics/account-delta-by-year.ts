import { defineEventHandler, readBody } from 'h3';
import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";
import { BalanceService } from "~/server/utils/balanceService";

/**
 * @swagger
 * /api/entry/analytics/account-delta-by-year:
 *   post:
 *     summary: 获取所选年份内各账户余额相较年初的变动
 *     tags: ["Analytics"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             selectedYear: string 年份(YYYY)
 *     responses:
 *       200:
 *         description: 获取成功
 */
export default defineEventHandler(async (event) => {
  try {
    const userId = await getUserId(event);
    const body = await readBody(event);
    const year: string = body?.selectedYear || new Date().getFullYear().toString();

    const startDay = `${year}-01-01`;
    const today = new Date();
    const isCurrentYear = today.getFullYear().toString() === year;
    const endDay = isCurrentYear ? today.toISOString().slice(0, 10) : `${year}-12-31`;

    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    });

    if (accounts.length === 0) {
      return success([]);
    }

    const accountIds = accounts.map((a) => a.id);

    const yearStartBalance: Record<number, number> = {};
    for (const accountId of accountIds) {
      const yearStartFlows = await prisma.flow.groupBy({
        by: ["accountId", "flowType"],
        where: {
          userId,
          accountId: accountId,
          day: { lt: startDay },
          transferId: null as any,
        },
        _sum: { money: true },
      });

      const yearStartTransferIn = await prisma.transfer.aggregate({
        where: {
          userId,
          toAccountId: accountId,
          day: { lt: startDay },
        },
        _sum: { amount: true },
      });
      const yearStartTransferOut = await prisma.transfer.aggregate({
        where: {
          userId,
          fromAccountId: accountId,
          day: { lt: startDay },
        },
        _sum: { amount: true },
      });

      const yearStartLoanFlows = await prisma.flow.findMany({
        where: {
          userId,
          accountId: accountId,
          day: { lt: startDay },
          OR: [
            { flowType: { in: ["借入", "借出", "收款", "还款"] } as any },
            { industryType: "借贷" as any },
            { payType: "借贷" as any }
          ],
          transferId: null as any
        }
      });

      let yearStartLoanImpact = 0;
      for (const loanFlow of yearStartLoanFlows) {
        const money = loanFlow.money || 0;
        const loanType = loanFlow.loanType || loanFlow.industryType;
        
        if (loanType && ['借入', '收款'].includes(loanType)) {
          yearStartLoanImpact += money;
        } else if (loanType && ['借出', '还款'].includes(loanType)) {
          yearStartLoanImpact -= money;
        }
      }

      let yearStartBalanceValue = 0;
      for (const flow of yearStartFlows) {
        const sumMoney = Number(flow._sum.money || 0);
        if (flow.flowType === "收入") yearStartBalanceValue += sumMoney;
        else if (flow.flowType === "支出") yearStartBalanceValue -= sumMoney;
        else if (flow.flowType === "借入" || flow.flowType === "收款") yearStartBalanceValue += sumMoney;
        else if (flow.flowType === "借出" || flow.flowType === "还款") yearStartBalanceValue -= sumMoney;
      }

      yearStartBalanceValue += (yearStartTransferIn._sum.amount || 0) - (yearStartTransferOut._sum.amount || 0) + yearStartLoanImpact;
      yearStartBalance[accountId] = yearStartBalanceValue;
    }

    const yearEndBalance: Record<number, number> = {};
    for (const accountId of accountIds) {
      const yearEndFlows = await prisma.flow.groupBy({
        by: ["accountId", "flowType"],
        where: {
          userId,
          accountId: accountId,
          day: { lte: endDay },
          transferId: null as any,
        },
        _sum: { money: true },
      });

      const yearEndTransferIn = await prisma.transfer.aggregate({
        where: {
          userId,
          toAccountId: accountId,
          day: { lte: endDay },
        },
        _sum: { amount: true },
      });
      const yearEndTransferOut = await prisma.transfer.aggregate({
        where: {
          userId,
          fromAccountId: accountId,
          day: { lte: endDay },
        },
        _sum: { amount: true },
      });

      const yearEndLoanFlows = await prisma.flow.findMany({
        where: {
          userId,
          accountId: accountId,
          day: { lte: endDay },
          OR: [
            { flowType: { in: ["借入", "借出", "收款", "还款"] } as any },
            { industryType: "借贷" as any },
            { payType: "借贷" as any }
          ],
          transferId: null as any
        }
      });

      let yearEndLoanImpact = 0;
      for (const loanFlow of yearEndLoanFlows) {
        const money = loanFlow.money || 0;
        const loanType = loanFlow.loanType || loanFlow.industryType;
        
        if (loanType && ['借入', '收款'].includes(loanType)) {
          yearEndLoanImpact += money;
        } else if (loanType && ['借出', '还款'].includes(loanType)) {
          yearEndLoanImpact -= money;
        }
      }

      let yearEndBalanceValue = 0;
      for (const flow of yearEndFlows) {
        const sumMoney = Number(flow._sum.money || 0);
        if (flow.flowType === "收入") yearEndBalanceValue += sumMoney;
        else if (flow.flowType === "支出") yearEndBalanceValue -= sumMoney;
        else if (flow.flowType === "借入" || flow.flowType === "收款") yearEndBalanceValue += sumMoney;
        else if (flow.flowType === "借出" || flow.flowType === "还款") yearEndBalanceValue -= sumMoney;
      }

      yearEndBalanceValue += (yearEndTransferIn._sum.amount || 0) - (yearEndTransferOut._sum.amount || 0) + yearEndLoanImpact;
      yearEndBalance[accountId] = yearEndBalanceValue;
    }

    const result = accounts.map((acc) => {
      const startBalance = yearStartBalance[acc.id] || 0;
      const endBalance = yearEndBalance[acc.id] || 0;
      const delta = endBalance - startBalance;
      
      return {
        accountId: acc.id,
        accountName: acc.name,
        delta: Number(delta.toFixed(2)),
      };
    });

    const filtered = result.filter((r) => Math.abs(r.delta) > 0.005);
    filtered.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return success({
      year,
      startDay,
      endDay,
      data: filtered,
    });
  } catch (e: any) {
    return error(e.message || "Failed to compute account delta by year");
  }
});


