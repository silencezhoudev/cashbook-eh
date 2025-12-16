import { defineEventHandler, readBody } from 'h3';
import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/flow/page:
 *   post:
 *     summary: 分页获取流水记录列表
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
 *             loanType: string 借贷类型（可选，借入/借出/收款/还款）
 *             industryType: string 行业分类（可选）
 *             payType: string 支付方式（可选）
 *             startDay: string 开始日期（可选）
 *             endDay: string 结束日期（可选）
 *             name: string 流水名称（可选，支持模糊查询）
 *             attribution: string 归属（可选，支持模糊查询）
 *             description: string 描述（可选，支持模糊查询）
 *             pageNum: number 页码（默认为1）
 *             pageSize: number 每页大小（默认为15，-1表示查询全部）
 *             moneySort: string 金额排序（asc/desc）
 *             minMoney: number 最小金额（可选）
 *             maxMoney: number 最大金额（可选）
 *             eliminate: string 不计入流水筛选（可选，0=计入流水，1=不计入流水）
 *     responses:
 *       200:
 *         description: 分页数据获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: PagePack<Flow> 流水分页数据
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

  const where: any = {};
  
  // 支持多账本查询
  if (body.selectedBookIds && Array.isArray(body.selectedBookIds) && body.selectedBookIds.length > 0) {
    // 多账本查询：查询指定账本列表
    where.bookId = { in: body.selectedBookIds };
  } else if (body.bookId && body.flowType !== '借贷') {
    // 单账本查询：按指定账本过滤
    where.bookId = { equals: body.bookId };
  } else {
    // 按用户维度查询全部账本
    where.userId = { equals: userId } as any;
  }

  // 普通查询条件
  if (body.id) {
    // equals 等于查询
    // contains 模糊查询（pgsql和mongo中，可以增加额外参数限制忽略大小写 mode: 'insensitive'）
    where.id = {
      equals: Number(body.id),
    };
  }
  if (body.flowType) {
    where.flowType = {
      equals: body.flowType,
    };
  }
  // 支持借贷类型过滤
  if (body.loanType) {
    where.loanType = {
      equals: body.loanType,
    };
  }
  if (body.industryType) {
    // 消费类型查询：支持模糊匹配以包含二级分类
    // 例如：查询"餐饮"时，应该包含"餐饮/火锅"、"餐饮/快餐"等
    where.industryType = {
      contains: body.industryType,
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
  // 关键字全局模糊匹配（名称/备注/归属/类型/支付方式/账户名/借贷对象）
  if (body.keyword && String(body.keyword).trim() !== "") {
    const kw = String(body.keyword).trim();
    where.OR = [
      { name: { contains: kw } },
      { description: { contains: kw } },
      { attribution: { contains: kw } },
      { industryType: { contains: kw } },
      { payType: { contains: kw } },
      { account: { name: { contains: kw } } },
      { counterparty: { contains: kw } }, // 支持借贷对象搜索
    ];
  }
  if (body.accountId) {
    console.log(`添加账户过滤条件: accountId = ${body.accountId}`);
    where.accountId = {
      equals: Number(body.accountId),
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

  // 分页条件
  const pageNum = Number(body.pageNum ? body.pageNum : 1);
  const pageSize = Number(body.pageSize ? body.pageSize : 200);
  const skip = (pageNum - 1) * pageSize; // 计算跳过的条目数

  // 排序条件
  const orderBy: any = [
    {
      day: "desc",
    },
    {
      id: "desc", // 添加 ID 排序以保持排序稳定
    },
  ];
  if (body.moneySort) {
    // console.log(body.moneySort)
    // 将金额排序设置到第一个
    orderBy.unshift({ money: String(body.moneySort) });
  }
  // 构建流水查询条件
  const flowWhere: any = { ...where };
  
  // 如果明确查询转账类型，则不查询 flow 表（仅返回 transfer 记录）
  if (body.flowType === '转账') {
    flowWhere.id = { equals: -1 };
  }
  // 如果明确查询借贷类型，仅按统一的新式借贷记录查询（与转账一致）
  if (body.flowType === '借贷') {
    flowWhere.attribution = '借贷';
    flowWhere.flowType = '转账';
  }
  
  // 对于账户查询，显示该账户的所有流水数据（包含借贷型转账对应的展示）
  // 对于非账户查询，排除转账生成的流水记录，避免重复计算
  if (!body.accountId) {
    flowWhere.transferId = null; // 非账户查询排除转账生成的流水
  }
  // 账户查询时，也排除转账生成的流水记录，避免显示重复的转账流水
  // 转账记录会通过transfer表单独显示
  if (body.accountId) {
    flowWhere.transferId = null; // 账户查询也排除转账生成的流水记录
  }

  // 查询流水数据（不分页，获取所有符合条件的流水）
  console.log(`查询条件(flow):`, JSON.stringify(flowWhere, null, 2));
  console.log(`原始请求参数:`, JSON.stringify(body, null, 2));
  const flows = await prisma.flow.findMany({ 
    where: flowWhere, 
    orderBy,
    include: {
      account: true, // 关联查询账户信息
      relatedAccount: true, // 关联查询关联账户信息（用于借贷记录）
      book: {
        select: {
          bookId: true,
          bookName: true,
          color: true
        }
      }, // 关联查询账本信息
      transfer: {
        include: {
          fromAccount: true,
          toAccount: true
        }
      }
    }
  } as any);
  console.log(`查询到 ${flows.length} 条流水记录`);

  // 查询转账数据（不分页，获取所有符合条件的转账）
  const transferWhere: any = {
    userId: userId
  };
  
  // 如果明确查询支出或收入类型，则不查询转账数据
  if (body.flowType === '支出' || body.flowType === '收入') {
    // 设置一个不可能匹配的条件，避免查询转账数据
    transferWhere.id = { equals: -1 };
  }
  
  // 如果明确查询借贷类型，则不查询转账数据（因为借贷记录已经在flow查询中处理了）
  if (body.flowType === '借贷') {
    // 设置一个不可能匹配的条件，避免查询转账数据，防止重复显示
    transferWhere.id = { equals: -1 };
  }
  
  // 若指定账本，则仅包含与该账本相关联的转账（但支出/收入查询时除外）
  if (body.bookId && body.flowType !== '支出' && body.flowType !== '收入') {
    transferWhere.flows = {
      some: { bookId: body.bookId }
    };
  }

  // 如果有账户ID过滤，只显示与该账户相关的转账（但支出/收入查询时除外）
  if (body.accountId && body.flowType !== '支出' && body.flowType !== '收入') {
    console.log(`添加转账账户过滤条件: accountId = ${body.accountId}`);
    const acctOr = [
      { fromAccountId: Number(body.accountId) },
      { toAccountId: Number(body.accountId) }
    ];
    // 合并已有 OR 条件，避免被覆盖
    if (transferWhere.OR) {
      transferWhere.OR = Array.isArray(transferWhere.OR)
        ? [...transferWhere.OR, ...acctOr]
        : [transferWhere.OR, ...acctOr];
    } else {
      transferWhere.OR = acctOr;
    }
  }

  // 转账关键字匹配（名称/备注/账户名）（但支出/收入查询时除外）
  if (body.keyword && String(body.keyword).trim() !== "" && body.flowType !== '支出' && body.flowType !== '收入') {
    const kw = String(body.keyword).trim();
    const kwOr = [
      { name: { contains: kw } },
      { description: { contains: kw } },
      { fromAccount: { name: { contains: kw } } },
      { toAccount: { name: { contains: kw } } },
    ];
    // 合并已有 OR 条件，避免被覆盖
    if (transferWhere.OR) {
      transferWhere.OR = Array.isArray(transferWhere.OR)
        ? [...transferWhere.OR, ...kwOr]
        : [transferWhere.OR, ...kwOr];
    } else {
      transferWhere.OR = kwOr;
    }
  }

  // 添加转账的查询条件（与流水类似）（但支出/收入查询时除外）
  if (body.flowType !== '支出' && body.flowType !== '收入') {
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
  }

  // 确保只查询有关联流水记录的转账（避免查询到已删除但未清理的旧记录）
  // 如果还没有设置 flows 条件，则添加一个确保至少有一条关联流水记录的条件
  if (!transferWhere.flows) {
    transferWhere.flows = {
      some: {} // 确保至少有一条关联的流水记录
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
  // 总记录数将在合并数据后计算
  
  // 统计时对于账户查询也排除转账生成的流水记录，对于非账户查询排除转账生成的流水记录
  const sumMoneyWhere = { ...flowWhere };
  // 统一排除转账生成的流水记录，避免重复计算
  sumMoneyWhere.transferId = null;
  
  const sumMoney = await prisma.flow.groupBy({
    by: ["flowType"],
    where: sumMoneyWhere,
    _sum: {
      money: true,
    },
  });

  // 统计 eliminate=1 的金额
  const zeroAgg = await prisma.flow.aggregate({
    where: { ...flowWhere, eliminate: 1 },
    _sum: { money: true }
  });
  
  // 当按账户维度统计时，补充计算转账方向金额（不受分页影响）
  let transferInAgg = { _sum: { amount: 0 } } as any;
  let transferOutAgg = { _sum: { amount: 0 } } as any;
  if (body.accountId) {
    const acctId = Number(body.accountId);
    // 基于相同过滤条件（bookId/date），单独聚合 to/from 方向
    const baseTransferFilter: any = { ...transferWhere };
    // 移除 OR，改为方向性过滤
    delete baseTransferFilter.OR;
    [transferInAgg, transferOutAgg] = await Promise.all([
      prisma.transfer.aggregate({
        where: { ...baseTransferFilter, toAccountId: acctId },
        _sum: { amount: true }
      }),
      prisma.transfer.aggregate({
        where: { ...baseTransferFilter, fromAccountId: acctId },
        _sum: { amount: true }
      })
    ]);
  }
  
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
  
  // 添加流水数据（排除由转账生成的流水记录，避免重复显示）
  flows.forEach(flow => {
    // 跳过由转账生成的流水记录（收入/支出类型且transferId不为null）
    // 注意：即使转账记录已被删除，只要transferId不为null，也应该跳过这些流水记录
    if ((flow.flowType === '收入' || flow.flowType === '支出') && 
        flow.industryType === '转账' && 
        flow.transferId !== null) {
      console.log(`跳过转账生成的流水记录: ID=${flow.id}, 类型=${flow.flowType}, 转账ID=${flow.transferId}`);
      return;
    }
    
    // 额外检查：如果flowType是"转账"，也应该跳过（这是转账记录本身，不是流水）
    if (flow.flowType === '转账' && flow.transferId !== null) {
      console.log(`跳过转账类型的流水记录: ID=${flow.id}, 转账ID=${flow.transferId}`);
      return;
    }
    
    // 如果是借贷类型的流水，需要从关联的转账记录中获取账户信息
    let fromAccount = null;
    let toAccount = null;
    
    // 借贷记录统一使用转账上的两个账户
    if (flow.attribution === '借贷' && (flow as any).transfer) {
      fromAccount = (flow as any).transfer.fromAccount;
      toAccount = (flow as any).transfer.toAccount;
    }
    
    // 使用数据库中的显示字段，如果没有则使用原始字段
    const displayFlowType = (flow as any).displayFlowType || flow.flowType;
    const displayIndustryType = (flow as any).displayIndustryType || flow.industryType;
    const displayPayType = flow.payType;
    
    combinedData.push({
      id: `flow_${flow.id}`,
      type: 'flow',
      day: flow.day,
      flowType: displayFlowType,
      industryType: displayIndustryType,
      payType: displayPayType,
      money: flow.money,
      name: flow.name,
      description: flow.description,
      attribution: flow.attribution,
      account: (flow as any).account,
      // 统一模型下不再使用 relatedAccount
      transfer: (flow as any).transfer,
      // 为借贷类型添加转账账户信息
      fromAccount: fromAccount,
      toAccount: toAccount,
      book: bookMap.get(flow.bookId) || null,
      // 借贷相关字段
      displayFlowType: (flow as any).displayFlowType,
      displayIndustryType: (flow as any).displayIndustryType,
      loanType: flow.loanType,
      counterparty: flow.counterparty,
      // 原始数据
      originalFlow: flow
    });
  });
  
  // 添加转账数据
  transfers.forEach(transfer => {
    // 验证转账是否有有效的关联流水记录，如果没有则跳过（可能是已删除的旧记录）
    if (!transfer.flows || transfer.flows.length === 0) {
      console.warn(`跳过没有关联流水记录的转账: transferId=${transfer.id}`);
      return;
    }
    
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
      // 借贷型转账，统一在列表“流水类型”显示为 借贷；“支出/收入类型”显示具体借贷类型
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
        // 显示控制字段
        displayFlowType: '借贷',
        displayIndustryType: (transfer as any).loanType || '借贷',
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
        account: null, // 转账没有单一账户
        transfer: transfer,
        book: book,
        // 转账特有字段
        fromAccount: transfer.fromAccount,
        toAccount: transfer.toAccount,
        // 显示控制字段
        displayFlowType: '转账',
        displayIndustryType: '转账',
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
  
  // 应用分页到合并后的数据
  let paginatedData = combinedData;
  if (pageSize !== -1) {
    const startIndex = skip;
    const endIndex = startIndex + pageSize;
    paginatedData = combinedData.slice(startIndex, endIndex);
  }
  
  const totalPages = Math.ceil(combinedData.length / pageSize);
  
  let totalIn = 0;
  let totalOut = 0;
  let notInOut = Number(zeroAgg?._sum?.money || 0);
  
  // 如果有账户ID过滤，按账户维度计算流入流出
  if (body.accountId) {
    // 计算该账户的流入/流出（包含所有流水类型）
    // 总流入：使该账户余额增加的所有金额
    // 总流出：使该账户余额减少的所有金额
    sumMoney.forEach((t: any) => {
      const money = Number(t._sum.money || 0);
      const flowType = t.flowType;
      
      // 根据流水类型判断对账户余额的影响
      // 借贷类型（借入、借出、收款、还款）应该通过转账记录处理，不应该在流水表中出现
      // 如果仍然存在，说明数据迁移未完成
      if (["收入"].includes(flowType)) {
        // 收入类型使账户余额增加
        totalIn += money;
      } else if (["支出"].includes(flowType)) {
        // 支出类型使账户余额减少
        totalOut += money;
      } else if (["借入", "收款"].includes(flowType)) {
        // 这些是遗留的借贷记录，应该已经合并为转账记录
        console.warn(`发现遗留的借贷流水记录: ID=${flows[0].id}, 类型=${flowType}, 数据迁移脚本尚未执行`);
        totalIn += money;
      } else if (["借出", "还款"].includes(flowType)) {
        // 这些是遗留的借贷记录，应该已经合并为转账记录
        console.warn(`发现遗留的借贷流水记录: ID=${flows[0].id}, 类型=${flowType}, 数据迁移脚本尚未执行`);
        totalOut += money;
      }
      // 转账类型在流水表中不会出现，因为转账是通过transfer表处理的
    });
    
    // 加上转账方向金额
    // 转账到该账户的金额算作流入（增加账户余额）
    totalIn += Number(transferInAgg?._sum?.amount || 0);
    // 从该账户转出的金额算作流出（减少账户余额）
    totalOut += Number(transferOutAgg?._sum?.amount || 0);
  } else {
    // 没有账户过滤时，按用户维度计算总收入支出
    sumMoney.forEach((t: any) => {
      if (t.flowType == "收入") {
        totalIn = Number(t._sum.money);
      } else if (t.flowType == "支出") {
        totalOut = Number(t._sum.money);
      }
    });
  }

  return success({
    total: combinedData.length,
    data: paginatedData,
    pages: totalPages,
    totalIn,
    totalOut,
    notInOut,
  });
});
