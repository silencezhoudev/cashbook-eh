import { defineEventHandler, readBody } from 'h3';
import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/flow/list:
 *   post:
 *     summary: 获取流水记录列表
 *     tags: ["Flow"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             id: number 流水ID（可选）
 *             flowType: string 流水类型（可选）
 *             industryType: string 行业分类（可选）
 *             payType: string 支付方式（可选）
 *             startDay: string 开始日期（可选）
 *             endDay: string 结束日期（可选）
 *             name: string 流水名称（可选，支持模糊查询）
 *             attribution: string 归属（可选，支持模糊查询）
 *             description: string 描述（可选，支持模糊查询）
 *             minMoney: number 最小金额（可选）
 *             maxMoney: number 最大金额（可选）
 *             eliminate: string 不计入流水筛选（可选，0=计入流水，1=不计入流水）
 *     responses:
 *       200:
 *         description: 流水记录列表获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: [] #[Flow流水记录数组]
 *       400:
 *         description: 获取失败
 *         content:
 *           application/json:
 *             schema:
 *               Error: {
 *                 message: "请先选择账本"
 *               }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event); // 获取查询参数
  const userId = await getUserId(event);

  if (!body.bookId) {
    return error("请先选择账本");
  }

  // 构建流水查询条件
  const where: any = {
    bookId: body.bookId,
  };

  // 添加条件：如果 `name` 存在，则根据 `name` 查询
  if (body.id) {
    where.id = {
      equals: Number(body.id),
    };
  }
  // 类型条件
  if (body.flowType) {
    where.flowType = {
      equals: body.flowType,
    };
  }
  if (body.industryType) {
    where.industryType = {
      equals: body.industryType,
    };
  }
  if (body.payType) {
    where.payType = {
      equals: body.payType,
    };
  }
  if (body.eliminate !== undefined && body.eliminate !== null && body.eliminate !== "") {
    where.eliminate = {
      equals: Number(body.eliminate),
    };
  }

  // 时间条件
  if (body.startDay && body.endDay) {
    where.day = {
      gte: body.startDay,
      lte: body.endDay,
    };
  } else if (body.startDay) {
    where.day = {
      gte: body.startDay,
    };
  } else if (body.endDay) {
    where.day = {
      lte: body.endDay,
    };
  }

  // 模糊条件
  if (body.name) {
    where.name = {
      contains: body.name,
    };
  }
  if (body.attribution) {
    where.attribution = {
      contains: body.attribution,
    };
  }
  if (body.description) {
    where.description = {
      contains: body.description,
    };
  }

  // 金额范围过滤
  if (
    body.minMoney !== undefined &&
    body.minMoney !== null &&
    body.minMoney !== ""
  ) {
    const min = Number(body.minMoney);
    if (!Number.isNaN(min)) {
      where.money = { ...(where.money || {}), gte: min };
    }
  }
  if (
    body.maxMoney !== undefined &&
    body.maxMoney !== null &&
    body.maxMoney !== ""
  ) {
    const max = Number(body.maxMoney);
    if (!Number.isNaN(max)) {
      where.money = { ...(where.money || {}), lte: max };
    }
  }

  // 查询流水数据
  const flows = await prisma.flow.findMany({
    where, // 使用条件查询
    include: {
      account: true, // 关联查询账户信息
      transfer: {
        include: {
          fromAccount: true,
          toAccount: true
        }
      }
    },
    orderBy: {
      day: 'desc' // 按日期倒序排列
    }
  });

  // 查询转账数据（包含借贷记录）
  const transferWhere: any = {
    userId: userId
  };
  
  // 若指定账本，则仅包含与该账本相关联的转账
  if (body.bookId) {
    transferWhere.flows = {
      some: { bookId: body.bookId }
    };
  }

  // 添加转账的时间条件
  if (body.startDay && body.endDay) {
    transferWhere.day = {
      gte: body.startDay,
      lte: body.endDay,
    };
  } else if (body.startDay) {
    transferWhere.day = {
      gte: body.startDay,
    };
  } else if (body.endDay) {
    transferWhere.day = {
      lte: body.endDay,
    };
  }

  const transfers = await prisma.transfer.findMany({
    where: transferWhere,
    include: {
      fromAccount: true,
      toAccount: true,
      flows: true
    },
    orderBy: [
      { day: "desc" },
      { id: "desc" }
    ]
  });

  // 获取所有相关的账本信息
  const allBookIds = [...new Set([
    ...flows.map(flow => flow.bookId),
    ...transfers.flatMap(transfer => 
      transfer.flows?.map(flow => flow.bookId) || []
    )
  ])];
  
  const books = await prisma.book.findMany({
    where: {
      bookId: {
        in: allBookIds
      }
    }
  });

  // 创建账本ID到账本信息的映射
  const bookMap = new Map(books.map(book => [book.bookId, book]));

  // 合并流水和转账数据，并统一格式
  const combinedData: any[] = [];
  
  // 添加流水数据
  flows.forEach(flow => {
    combinedData.push({
      id: `flow_${flow.id}`,
      type: 'flow',
      day: flow.day,
      flowType: flow.flowType,
      industryType: flow.industryType,
      payType: flow.payType,
      money: flow.money,
      name: flow.name,
      description: flow.description,
      attribution: flow.attribution,
      account: flow.account,
      transfer: flow.transfer,
      book: bookMap.get(flow.bookId) || null,
      // 借贷相关字段
      loanType: flow.loanType,
      counterparty: flow.counterparty,
      // 原始数据
      originalFlow: flow
    });
  });
  
  // 添加转账数据
  transfers.forEach(transfer => {
    // 从关联的流水记录中获取账本信息
    const transferBookIds = transfer.flows?.map(flow => flow.bookId) || [];
    const transferBooks = transferBookIds.map(bookId => bookMap.get(bookId)).filter(Boolean);
    
    // 如果没有从关联流水获取到账本信息，尝试从请求参数中获取
    let book = transferBooks.length > 0 ? transferBooks[0] : null;
    
    // 如果仍然没有账本信息，且请求中指定了单个账本，使用该账本
    if (!book && allBookIds.length === 1) {
      book = bookMap.get(allBookIds[0]) || null;
    }
    
    if ((transfer as any).transferType === 'loan' || (transfer as any).loanType) {
      // 借贷型转账
      combinedData.push({
        id: `transfer_${transfer.id}`,
        type: 'transfer',
        day: transfer.day,
        flowType: '借贷',
        industryType: (transfer as any).loanType || '借贷',
        payType: '转账',
        money: transfer.amount,
        name: transfer.name || `${(transfer as any).loanType || '借贷'}-${(transfer as any).counterparty || ''}`,
        description: transfer.description,
        attribution: '借贷',
        account: null,
        transfer: transfer,
        book: book,
        fromAccount: transfer.fromAccount,
        toAccount: transfer.toAccount,
        // 借贷相关字段
        loanType: (transfer as any).loanType || null,
        counterparty: (transfer as any).counterparty || null,
        // 原始数据
        originalTransfer: transfer
      });
    } else {
      // 普通转账
      combinedData.push({
        id: `transfer_${transfer.id}`,
        type: 'transfer',
        day: transfer.day,
        flowType: '转账',
        industryType: '转账',
        payType: '转账',
        money: transfer.amount,
        name: transfer.name || `从${transfer.fromAccount.name}转账到${transfer.toAccount.name}`,
        description: transfer.description,
        attribution: '',
        account: null,
        transfer: transfer,
        book: book,
        fromAccount: transfer.fromAccount,
        toAccount: transfer.toAccount,
        // 转账特有字段
        loanType: null,
        counterparty: null,
        // 原始数据
        originalTransfer: transfer
      });
    }
  });
  
  // 按日期和ID排序
  combinedData.sort((a, b) => {
    if (a.day !== b.day) {
      return new Date(b.day).getTime() - new Date(a.day).getTime();
    }
    return parseInt(b.id.split('_')[1]) - parseInt(a.id.split('_')[1]);
  });

  return success(combinedData);
});
