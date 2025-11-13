import prisma from "~/lib/prisma";

/**
 * @swagger
 * /api/entry/flow/condidate/autos:
 *   post:
 *     summary: 自动查找候选平账记录
 *     tags: ["Candidate"]
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
 *         description: 候选记录获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: [] #{ out: Flow 支出记录, in: Flow 收入记录}
 *       400:
 *         description: 获取失败
 *         content:
 *           application/json:
 *             schema:
 *               Error: {
 *                 message: "No Find bookid"
 *               }
 */
// 此处的相似性判断示例：金额完全相等（你可根据业务需要添加金额误差、日期范围等条件）
const isTransferLikeFlow = (flow: any) => {
  if (!flow) return false;
  if (flow.transferId) return true;
  const markers = [
    flow.flowType,
    flow.displayFlowType,
    flow.industryType,
    flow.displayIndustryType,
    flow.attribution,
  ];
  return markers.some((value) => value === "转账");
};

const amountKey = (money: number | null | undefined) =>
  Number(money || 0).toFixed(2);

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body.bookId) {
    return error("No Find bookid");
  }

  const bookId = String(body.bookId);

  const [expenditures, incomes] = await Promise.all([
    prisma.flow.findMany({
      where: { flowType: "支出", eliminate: 0, bookId },
      include: {
        account: { select: { id: true } },
      },
      orderBy: [{ day: "desc" }],
    }),
    prisma.flow.findMany({
      where: {
        flowType: { in: ["收入", "不计收支"] },
        eliminate: 0,
        bookId,
      },
      include: {
        account: { select: { id: true } },
      },
    }),
  ]);

  const filteredExpenses = expenditures.filter((expense) => !isTransferLikeFlow(expense));
  const filteredIncomes = incomes.filter((income) => !isTransferLikeFlow(income));

  const incomeMap = new Map<string, typeof filteredIncomes>();
  filteredIncomes.forEach((income) => {
    const key = amountKey(income.money);
    const list = incomeMap.get(key) || [];
    list.push(income);
    incomeMap.set(key, list);
  });

  const usedIncomeIds = new Set<number>();
  const candidatePairs: { out: typeof filteredExpenses[number]; in: typeof filteredIncomes[number] }[] = [];

  filteredExpenses.forEach((expense) => {
    const key = amountKey(expense.money);
    const sameAmountIncomes = incomeMap.get(key);
    if (!sameAmountIncomes || sameAmountIncomes.length === 0) {
      return;
    }

    const matchedIncome = sameAmountIncomes.find((income) => {
      if (usedIncomeIds.has(income.id)) {
        return false;
      }

      // 当双方都有账户时，要求完全一致（同一账户内的退款）
      if (expense.accountId && income.accountId) {
        return expense.accountId === income.accountId;
      }

      return true;
    });

    if (!matchedIncome) {
      return;
    }

    candidatePairs.push({ out: expense, in: matchedIncome });
    usedIncomeIds.add(matchedIncome.id);
  });

  return success(candidatePairs);
});
