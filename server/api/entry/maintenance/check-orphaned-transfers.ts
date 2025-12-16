import prisma from "~/lib/prisma";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * 检查数据库中的孤立转账记录和流水记录
 * 1. 没有关联flows的transfer记录（孤立transfer）
 * 2. transferId指向不存在transfer的flow记录（孤立flow）
 * 3. 同一个transfer有多条重复的flow记录
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);

  try {
    // 1. 查找所有transfer记录及其关联的flows
    const allTransfers = await prisma.transfer.findMany({
      where: { userId },
      include: {
        flows: true,
        fromAccount: true,
        toAccount: true
      }
    });

    // 2. 查找所有有transferId的flow记录
    const flowsWithTransferId = await prisma.flow.findMany({
      where: {
        userId,
        transferId: { not: null }
      },
      include: {
        transfer: true,
        account: true
      }
    });

    // 3. 检查孤立transfer（没有关联flows的transfer）
    const orphanedTransfers = allTransfers.filter(t => !t.flows || t.flows.length === 0);

    // 4. 检查孤立flow（transferId指向不存在的transfer）
    const orphanedFlows = flowsWithTransferId.filter(f => !f.transfer);

    // 5. 检查重复flow（同一个transfer有多条相同类型的flow）
    const duplicateFlows: any[] = [];
    allTransfers.forEach(transfer => {
      if (transfer.flows && transfer.flows.length > 0) {
        // 按flowType分组
        const flowsByType = new Map<string, any[]>();
        transfer.flows.forEach(flow => {
          const key = `${flow.flowType}_${flow.accountId}`;
          if (!flowsByType.has(key)) {
            flowsByType.set(key, []);
          }
          flowsByType.get(key)!.push(flow);
        });
        
        // 检查是否有重复
        flowsByType.forEach((flows, key) => {
          if (flows.length > 1) {
            duplicateFlows.push({
              transferId: transfer.id,
              transfer: transfer,
              flows: flows,
              type: key
            });
          }
        });
      }
    });

    // 6. 检查11月18日交通银行的转账问题（根据用户描述）
    const problemTransfers = allTransfers.filter(t => {
      const isNov18 = t.day && t.day.startsWith('2025-11-18');
      const isBankOfComm = t.fromAccount?.name?.includes('交通银行') || 
                          t.toAccount?.name?.includes('交通银行');
      return isNov18 && isBankOfComm;
    });

    // 7. 统计信息
    const stats = {
      totalTransfers: allTransfers.length,
      totalFlowsWithTransferId: flowsWithTransferId.length,
      orphanedTransfers: orphanedTransfers.length,
      orphanedFlows: orphanedFlows.length,
      duplicateFlowGroups: duplicateFlows.length,
      problemTransfers: problemTransfers.length
    };

    return success({
      stats,
      orphanedTransfers: orphanedTransfers.map(t => ({
        id: t.id,
        day: t.day,
        amount: t.amount,
        fromAccount: t.fromAccount?.name,
        toAccount: t.toAccount?.name,
        name: t.name,
        description: t.description
      })),
      orphanedFlows: orphanedFlows.map(f => ({
        id: f.id,
        transferId: f.transferId,
        day: f.day,
        flowType: f.flowType,
        money: f.money,
        account: f.account?.name,
        name: f.name,
        description: f.description
      })),
      duplicateFlows: duplicateFlows.map(d => ({
        transferId: d.transferId,
        transfer: {
          id: d.transfer.id,
          day: d.transfer.day,
          amount: d.transfer.amount,
          fromAccount: d.transfer.fromAccount?.name,
          toAccount: d.transfer.toAccount?.name
        },
        flows: d.flows.map((f: any) => ({
          id: f.id,
          flowType: f.flowType,
          money: f.money,
          accountId: f.accountId,
          account: f.account?.name,
          day: f.day
        })),
        type: d.type
      })),
      problemTransfers: problemTransfers.map(t => ({
        id: t.id,
        day: t.day,
        amount: t.amount,
        fromAccount: t.fromAccount?.name,
        toAccount: t.toAccount?.name,
        name: t.name,
        description: t.description,
        flows: t.flows?.map(f => ({
          id: f.id,
          flowType: f.flowType,
          money: f.money,
          accountId: f.accountId,
          account: f.account?.name
        })) || []
      }))
    });
  } catch (err: any) {
    console.error('检查孤立记录失败:', err);
    return error(err.message || '检查孤立记录失败');
  }
});

