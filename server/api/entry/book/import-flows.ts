import prisma from "~/lib/prisma";
import type { Prisma } from "@prisma/client";
import { WacaiExcelParser, type FlowData } from "~/server/utils/wacaiExcelParser";
import { AccountImportService } from "~/server/utils/accountImportService";
import { BalanceService } from "~/server/utils/balanceService";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/book/import-flows:
 *   post:
 *     summary: 账本流水导入
 *     tags: ["Book Import"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             fileBuffer: ArrayBuffer Excel文件缓冲区
 *             autoCreateAccounts: boolean 是否自动创建账户
 *     responses:
 *       200:
 *         description: 导入成功
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: {
 *                   flows: Flow[] 导入的流水记录
 *                   accounts: Account[] 创建的账户
 *                   errors: ImportError[] 导入错误
 *                   stats: ImportStats 导入统计
 *                 }
 *       400:
 *         description: 导入失败
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  console.log('=== 开始处理导入请求 ===');
  console.log('请求体包含字段:', Object.keys(body));
  console.log('文件缓冲区类型:', typeof body.fileBuffer);
  console.log('文件缓冲区长度:', Array.isArray(body.fileBuffer) ? body.fileBuffer.length : 'N/A');
  console.log('是否有编辑数据:', !!body.editedData);
  
  if (!body.bookId) {
    return error("请先选择账本");
  }
  
  // 支持两种导入方式：文件导入或编辑数据导入
  if (!body.fileBuffer && !body.editedData) {
    return error("请上传Excel文件或提供编辑数据");
  }
  
  // 将数组转换回ArrayBuffer
  let fileBuffer: ArrayBuffer;
  if (Array.isArray(body.fileBuffer)) {
    fileBuffer = new Uint8Array(body.fileBuffer).buffer;
    console.log('✓ 数组转换为ArrayBuffer完成，大小:', fileBuffer.byteLength, 'bytes');
  } else {
    console.error('❌ 文件缓冲区格式错误');
    return error("文件格式错误");
  }
  
  // 检查文件大小（限制10MB）
  const maxFileSize = 10 * 1024 * 1024; // 10MB
  if (fileBuffer.byteLength > maxFileSize) {
    return error("文件大小超过限制（最大10MB）");
  }
  
  const userId = await getUserId(event);
  
  try {
    console.log('开始导入处理，用户ID:', userId, '账本ID:', body.bookId);
    
    // 1. 验证用户权限
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return error("用户不存在");
    }
    
    // 2. 验证账本权限
    const book = await prisma.book.findFirst({
      where: { 
        bookId: body.bookId, 
        userId: userId 
      }
    });
    
    if (!book) {
      return error("账本不存在或无权限");
    }
    
    // 2. 解析数据（文件或编辑数据）
    let parsedData: any;
    try {
      if (body.editedData) {
        // 使用编辑后的数据
        parsedData = {
          data: body.editedData.map((item: any) => item.original),
          headers: ['日期时间', '类型', '类别', '金额', '币种', '收付款人', '收付账户', '参与人', '标签', '商家', '属性', '备注']
        };
        console.log('使用编辑数据，行数:', parsedData.data.length);
      } else {
        // 解析Excel文件
        console.log('开始解析Excel文件...');
        parsedData = await WacaiExcelParser.parseExcelFile(fileBuffer);
        console.log('Excel文件解析完成，数据行数:', parsedData.data.length);
        if (parsedData.data.length === 0) {
          return error("Excel文件中没有有效数据");
        }
      }
    } catch (parseError) {
      console.error('数据解析失败:', parseError);
      return error(`数据解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    
    // 3. 批量处理流水和账户（增加超时时间到30秒）
    console.log('开始事务处理，总行数:', parsedData.data.length);
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdFlows: any[] = [];
      const createdAccounts: any[] = [];
      const errors: ImportError[] = [];
      const skippedRows: ImportError[] = []; // 记录被跳过的行
      const processedAccountIds = new Set<number>();
      
      console.log('开始处理数据行...');
      for (const [index, row] of parsedData.data.entries()) {
        try {
          console.log(`处理第 ${index + 1}/${parsedData.data.length} 行:`, row);
          
          // 解析流水数据
          const flowData = WacaiExcelParser.parseFlowRow(row, parsedData.headers);
          
          // 验证必要字段
          if (!flowData.day || !flowData.flowType || !flowData.money) {
            const errorInfo = {
              row: index + 2, // +2 因为跳过表头，且从1开始计数
              error: '缺少必要字段：日期、类型或金额',
              data: row
            };
            errors.push(errorInfo);
            skippedRows.push(errorInfo);
            continue;
          }
          
          // 处理账户和转账
          let accountId = null;
          let transferId = null;
          
          if (flowData.isTransfer) {
            // 处理转账
            try {
              console.log(`处理转账: ${flowData.fromAccount} -> ${flowData.toAccount}, 金额: ${flowData.transferAmount}`);
              
              // 创建或获取转出账户
              const fromAccountId = await AccountImportService.handleAccountImport(tx, {
                bookId: body.bookId,
                userId: userId,
                accountName: flowData.fromAccount!
              });
              
              // 创建或获取转入账户
              const toAccountId = await AccountImportService.handleAccountImport(tx, {
                bookId: body.bookId,
                userId: userId,
                accountName: flowData.toAccount!
              });
              
              // 创建转账记录
              const transfer = await tx.transfer.create({
                data: {
                  userId: userId,
                  fromAccountId: fromAccountId,
                  toAccountId: toAccountId,
                  amount: flowData.transferAmount!,
                  day: flowData.day!,
                  name: flowData.name || '转账',
                  description: flowData.description || ''
                }
              });
              
              transferId = transfer.id;
              console.log(`转账记录创建成功: ID=${transferId}`);
              
              // 将转账记录添加到成功导入列表
              createdFlows.push(transfer);
              console.log(`转账记录已添加到成功导入列表: ID=${transferId}`);
              
              // 添加到已处理账户列表
              [fromAccountId, toAccountId].forEach(id => {
                if (!processedAccountIds.has(id)) {
                  processedAccountIds.add(id);
                }
              });
              
            } catch (transferError) {
              console.error(`转账处理失败: ${transferError}`);
              const errorInfo = {
                row: index + 2,
                error: `转账处理失败: ${transferError instanceof Error ? transferError.message : String(transferError)}`,
                data: row
              };
              errors.push(errorInfo);
              skippedRows.push(errorInfo);
              continue;
            }
          } else if (flowData.accountName) {
            // 处理普通账户
            try {
              console.log(`处理账户: ${flowData.accountName}`);
              accountId = await AccountImportService.handleAccountImport(tx, {
                bookId: body.bookId,
                userId: userId,
                accountName: flowData.accountName
              });
              
              console.log(`账户处理完成: ID=${accountId}`);
              
              if (!processedAccountIds.has(accountId)) {
                processedAccountIds.add(accountId);
                const account = await tx.account.findUnique({
                  where: { id: accountId }
                });
                if (account) {
                  createdAccounts.push(account);
                  console.log(`添加到创建账户列表: ${account.name} (ID=${account.id})`);
                }
              } else {
                console.log(`账户ID=${accountId} 已存在于处理列表中`);
              }
            } catch (accountError) {
              console.error(`账户处理失败: ${accountError}`);
              const errorInfo = {
                row: index + 2,
                error: `账户处理失败: ${accountError instanceof Error ? accountError.message : String(accountError)}`,
                data: row
              };
              errors.push(errorInfo);
              skippedRows.push(errorInfo);
              // 账户处理失败时跳过整行，不创建流水记录
              continue;
            }
          } else {
            console.log(`第${index + 2}行没有账户信息，跳过整行处理`);
            const errorInfo = {
              row: index + 2,
              error: '缺少账户信息',
              data: row
            };
            errors.push(errorInfo);
            skippedRows.push(errorInfo);
            continue;
          }
          
          // 创建流水
          if (flowData.isTransfer) {
            // 转账类型：为转出和转入账户各创建一条流水记录
            console.log(`为转账创建流水记录: 转出账户=${flowData.fromAccount}, 转入账户=${flowData.toAccount}`);
            
            // 使用之前已获取的账户ID，避免重复获取
            const fromAccountId = await AccountImportService.handleAccountImport(tx, {
              bookId: body.bookId,
              userId: userId,
              accountName: flowData.fromAccount!
            });
            
            const toAccountId = await AccountImportService.handleAccountImport(tx, {
              bookId: body.bookId,
              userId: userId,
              accountName: flowData.toAccount!
            });
            
            // 创建转出流水记录
            const fromFlow = await tx.flow.create({
              data: {
                userId: userId,
                bookId: body.bookId,
                day: flowData.day!,
                flowType: '支出',
                industryType: '转账',
                payType: '转账',
                money: flowData.transferAmount!,
                name: flowData.name || `转账到${flowData.toAccount}`,
                description: flowData.description || '',
                invoice: '',
                attribution: '',
                accountId: fromAccountId,
                transferId: transferId
              }
            });
            
            // 创建转入流水记录
            const toFlow = await tx.flow.create({
              data: {
                userId: userId,
                bookId: body.bookId,
                day: flowData.day!,
                flowType: '收入',
                industryType: '转账',
                payType: '转账',
                money: flowData.transferAmount!,
                name: flowData.name || `从${flowData.fromAccount}转账`,
                description: flowData.description || '',
                invoice: '',
                attribution: '',
                accountId: toAccountId,
                transferId: transferId
              }
            });
            
            createdFlows.push(fromFlow, toFlow);
            console.log(`转账流水记录创建成功: 转出流水ID=${fromFlow.id} (账户ID=${fromAccountId}), 转入流水ID=${toFlow.id} (账户ID=${toAccountId})`);
          } else if (flowData.isLoan) {
            // 借贷流水：使用统一转账管理方式
            console.log(`处理借贷流水: ${flowData.loanType} - ${flowData.counterparty}`);
            
            // 创建或获取实际资金账户
            let fromAccountId = null;
            let toAccountId = null;
            
            if (flowData.accountName) {
              // 如果有实际账户信息，使用实际账户
              fromAccountId = await AccountImportService.handleAccountImport(tx, {
                bookId: body.bookId,
                userId: userId,
                accountName: flowData.accountName
              });
              
              // 根据借贷类型确定转出和转入账户
              if (flowData.loanType === '借入' || flowData.loanType === '收款') {
                // 借入/收款：从借贷对象账户转入实际账户
                toAccountId = fromAccountId;
                fromAccountId = await AccountImportService.handleAccountImport(tx, {
                  bookId: body.bookId,
                  userId: userId,
                  accountName: `借贷-${flowData.counterparty}`
                });
              } else {
                // 借出/还款：从实际账户转出到借贷对象账户
                toAccountId = await AccountImportService.handleAccountImport(tx, {
                  bookId: body.bookId,
                  userId: userId,
                  accountName: `借贷-${flowData.counterparty}`
                });
              }
            } else {
              // 如果没有实际账户信息，创建借贷账户对
              fromAccountId = await AccountImportService.handleAccountImport(tx, {
                bookId: body.bookId,
                userId: userId,
                accountName: `借贷-${flowData.counterparty}`
              });
              
              toAccountId = await AccountImportService.handleAccountImport(tx, {
                bookId: body.bookId,
                userId: userId,
                accountName: '现金' // 默认使用现金账户
              });
            }
            
            // 创建统一转账记录
            const transferData: any = {
              userId: userId,
              fromAccountId: fromAccountId,
              toAccountId: toAccountId,
              amount: flowData.money!,
              day: flowData.day!,
              name: `${flowData.loanType}-${flowData.counterparty}`,
              description: flowData.description || '',
              transferType: 'loan',
              loanType: flowData.loanType,
              counterparty: flowData.counterparty
            };
            const transfer = await tx.transfer.create({
              data: transferData
            });
            
            transferId = transfer.id;
            console.log(`借贷转账记录创建成功: ID=${transferId}`);
            
            // 创建转出流水记录
            const fromFlowData: any = {
              userId: userId,
              bookId: body.bookId,
              day: flowData.day!,
              flowType: '转账',
              industryType: '转账',
              payType: '转账',
              money: flowData.money!,
              name: `${flowData.loanType}给${flowData.counterparty}`,
              description: flowData.description || '',
              invoice: '',
              attribution: '借贷',
              accountId: fromAccountId,
              transferId: transferId,
              // 设置显示字段
              displayFlowType: '借贷',
              displayIndustryType: flowData.loanType
            };
            const fromFlow = await tx.flow.create({
              data: fromFlowData
            });
            
            // 创建转入流水记录
            const toFlowData: any = {
              userId: userId,
              bookId: body.bookId,
              day: flowData.day!,
              flowType: '转账',
              industryType: '转账',
              payType: '转账',
              money: flowData.money!,
              name: `${flowData.loanType}给${flowData.counterparty}`,
              description: flowData.description || '',
              invoice: '',
              attribution: '借贷',
              accountId: toAccountId,
              transferId: transferId,
              // 设置显示字段
              displayFlowType: '借贷',
              displayIndustryType: flowData.loanType
            };
            const toFlow = await tx.flow.create({
              data: toFlowData
            });
            
            createdFlows.push(transfer, fromFlow, toFlow);
            console.log(`借贷流水记录创建成功: 转账ID=${transferId}, 转出流水ID=${fromFlow.id}, 转入流水ID=${toFlow.id}`);
            
            // 添加到已处理账户列表
            [fromAccountId, toAccountId].forEach(id => {
              if (!processedAccountIds.has(id)) {
                processedAccountIds.add(id);
              }
            });
            
            // 获取账户信息并添加到创建列表
            const accountsToAdd = [fromAccountId, toAccountId];
            for (const accountId of accountsToAdd) {
              const account = await tx.account.findUnique({
                where: { id: accountId }
              });
              if (account && !createdAccounts.find(a => a.id === accountId)) {
                createdAccounts.push(account);
                console.log(`添加到创建账户列表: ${account.name} (ID=${account.id})`);
              }
            }
          } else {
            // 普通流水
            console.log(`创建普通流水，账户ID: ${accountId}, 账户名称: ${flowData.accountName}`);
            const flow = await tx.flow.create({
              data: {
                userId: userId,
                bookId: body.bookId,
                day: flowData.day!,
                flowType: flowData.flowType!,
                industryType: flowData.industryType || '',
                payType: '', // 挖财数据中没有支付方式字段
                money: flowData.money!,
                name: flowData.name || '',
                description: flowData.description || '',
                invoice: '',
                attribution: '',
                accountId: accountId
              }
            });
            
            createdFlows.push(flow);
            console.log(`普通流水创建成功: ID=${flow.id}, 账户ID=${flow.accountId}`);
          }
          
        } catch (rowError) {
          console.error(`处理第 ${index + 1} 行时出错:`, rowError);
          const errorInfo = {
            row: index + 2,
            error: rowError instanceof Error ? rowError.message : String(rowError),
            data: row
          };
          errors.push(errorInfo);
          skippedRows.push(errorInfo);
        }
      }
      
      console.log('数据行处理完成，开始更新账户余额...');
      
      // 4. 更新账户余额
      if (processedAccountIds.size > 0) {
        await AccountImportService.updateMultipleAccountBalances(
          tx, 
          Array.from(processedAccountIds)
        );
      }
      
      console.log('事务处理完成，统计结果:', {
        totalRows: parsedData.data.length,
        successCount: createdFlows.length,
        errorCount: errors.length,
        skippedCount: skippedRows.length,
        accountCount: createdAccounts.length
      });
      
      return {
        flows: createdFlows,
        accounts: createdAccounts,
        errors,
        skippedRows, // 添加被跳过的行信息
        stats: {
          totalRows: parsedData.data.length,
          successCount: createdFlows.length,
          errorCount: errors.length,
          skippedCount: skippedRows.length, // 添加跳过行数统计
          accountCount: createdAccounts.length
        }
      };
    }, {
      timeout: 30000 // 30秒超时
    });
    
    console.log('导入处理完成，返回结果');
    return success(result);
    
  } catch (err) {
    console.error('账本导入失败:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return error(`导入失败: ${errorMessage}`);
  }
});

/**
 * 导入错误接口
 */
interface ImportError {
  row: number;
  error: string;
  data: any[];
}

/**
 * 导入统计接口
 */
interface ImportStats {
  totalRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number; // 添加跳过行数
  accountCount: number;
}
