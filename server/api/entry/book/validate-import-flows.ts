import prisma from "~/lib/prisma";
import { WacaiExcelParser } from "~/server/utils/wacaiExcelParser";
import { AccountImportService } from "~/server/utils/accountImportService";
import { getUserId, success, error } from "~/server/utils/common";

/**
 * @swagger
 * /api/entry/book/validate-import-flows:
 *   post:
 *     summary: 验证导入数据
 *     tags: ["Book Import"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             fileBuffer: ArrayBuffer Excel文件缓冲区
 *             bookId: string 账本ID
 *     responses:
 *       200:
 *         description: 验证完成
 *         content:
 *           application/json:
 *             schema:
 *               Result:
 *                 d: ValidationResult 验证结果
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  console.log('=== 开始处理验证请求 ===');
  console.log('请求体包含字段:', Object.keys(body));
  console.log('文件缓冲区类型:', typeof body.fileBuffer);
  console.log('文件缓冲区长度:', Array.isArray(body.fileBuffer) ? body.fileBuffer.length : 'N/A');
  console.log('账本ID:', body.bookId);
  
  if (!body.fileBuffer) {
    console.error('❌ 缺少文件缓冲区');
    return error("请上传Excel文件");
  }
  
  if (!body.bookId) {
    console.error('❌ 缺少账本ID');
    return error("请选择目标账本");
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
  
  const userId = await getUserId(event);
  if (!userId) {
    console.error('❌ 用户未登录');
    return error("用户未登录");
  }
  
  console.log('✓ 用户ID:', userId);
  
  try {
    // 验证账本权限
    console.log('步骤1: 验证账本权限...');
    const book = await prisma.book.findFirst({
      where: {
        bookId: body.bookId,
        userId: userId
      }
    });
    
    if (!book) {
      console.error('❌ 账本不存在或无权限');
      return error("账本不存在或无权限");
    }
    
    console.log('✓ 账本验证通过:', book.bookName);
    
    // 1. 解析Excel文件
    console.log('步骤2: 解析Excel文件...');
    const parsedData = await WacaiExcelParser.parseExcelFile(fileBuffer);
    
    console.log('✓ Excel解析完成:', {
      headers: parsedData.headers,
      dataRows: parsedData.data.length,
      metadata: parsedData.metadata
    });
    
    if (parsedData.data.length === 0) {
      console.error('❌ Excel文件中没有有效数据');
      return error("Excel文件中没有有效数据");
    }
    
    // 2. 验证数据
    console.log('步骤3: 开始验证数据...');
    const validationResults = await validateImportData(parsedData, body.bookId, userId, book.bookName);
    
    console.log('✓ 数据验证完成:', {
      isValid: validationResults.isValid,
      totalRows: validationResults.stats.totalRows,
      validRows: validationResults.stats.validRows,
      invalidRows: validationResults.stats.invalidRows,
      errors: validationResults.errors.length,
      warnings: validationResults.warnings.length
    });
    
    console.log('=== 验证请求处理完成 ===');
    return success(validationResults);
    
  } catch (err: unknown) {
    console.error('=== 数据验证失败 ===');
    console.error('错误对象:', err);
    console.error('错误类型:', typeof err);
    console.error('错误堆栈:', err instanceof Error ? err.stack : 'N/A');
    
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('最终错误消息:', errorMessage);
    
    return error(`验证失败: ${errorMessage}`);
  }
});

/**
 * 验证导入数据
 */
async function validateImportData(parsedData: any, bookId: string, userId: number, bookName: string): Promise<ValidationResult> {
  console.log('开始验证导入数据...');
  console.log('数据行数:', parsedData.data.length);
  
  const validationResults: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    stats: {
      totalRows: parsedData.data.length,
      validRows: 0,
      invalidRows: 0,
      newAccounts: 0,
      existingAccounts: 0,
      duplicateRows: 0
    },
    metadata: {
      ...parsedData.metadata,
      bookName: bookName // 使用实际选择的账本名称
    },
    sampleData: [],
    allData: [], // 添加完整数据字段
    newAccounts: [], // 新账户列表
    existingAccounts: [] // 已存在账户列表
  };
  
  const seenRows = new Set<string>();
  const accountNames = new Set<string>();
  const newAccountNames = new Set<string>();
  const existingAccountNames = new Set<string>();
  const totalRows = parsedData.data.length;
  
  console.log(`开始验证 ${totalRows} 行数据...`);
  
  // 验证每个数据行
  for (const [index, row] of parsedData.data.entries()) {
    // 每处理100行或最后一行时输出进度
    if (index % 100 === 0 || index === totalRows - 1) {
      const progress = Math.round((index + 1) / totalRows * 100);
      console.log(`验证进度: ${index + 1}/${totalRows} (${progress}%)`);
    }
    const rowNumber = index + 2; // +2 因为跳过表头，且从1开始计数
    
    try {
      // 解析流水数据
      const flowData = WacaiExcelParser.parseFlowRow(row, parsedData.headers);
      
      // 创建行唯一标识（用于检测重复）
      const rowKey = `${flowData.day}_${flowData.flowType}_${flowData.money}_${flowData.accountName}`;
      
      // 检查重复行
      if (seenRows.has(rowKey)) {
        validationResults.stats.duplicateRows++;
        validationResults.warnings.push({
          row: rowNumber,
          message: '检测到重复的流水记录',
          data: row
        });
      } else {
        seenRows.add(rowKey);
      }
      
      // 验证必要字段
      const fieldValidation = validateFlowFields(flowData, rowNumber);
      if (!fieldValidation.isValid) {
        validationResults.errors.push(...fieldValidation.errors);
        validationResults.stats.invalidRows++;
        continue;
      }
      
      // 验证账户数据
      if (flowData.accountName) {
        const accountValidation = AccountImportService.validateAccountData(flowData.accountName);
        if (!accountValidation.isValid) {
          validationResults.errors.push({
            row: rowNumber,
            message: `账户验证失败: ${accountValidation.errors.join(', ')}`,
            data: row
          });
          validationResults.stats.invalidRows++;
          continue;
        }
        
        // 统计账户信息
        if (!accountNames.has(flowData.accountName)) {
          accountNames.add(flowData.accountName);
          // 检查账户是否已存在
          const cleanedAccountName = cleanAccountName(flowData.accountName);
          if (cleanedAccountName) { // 只有清理后不为空的账户才进行统计
            const isExistingAccount = await checkExistingAccount(flowData.accountName, userId);
            if (isExistingAccount) {
              validationResults.stats.existingAccounts++;
              existingAccountNames.add(cleanedAccountName);
            } else {
              validationResults.stats.newAccounts++;
              newAccountNames.add(cleanedAccountName);
            }
          }
        }
      }
      
      // 处理转账账户
      if (flowData.isTransfer) {
        if (flowData.fromAccount && !accountNames.has(flowData.fromAccount)) {
          accountNames.add(flowData.fromAccount);
          const cleanedFromAccount = cleanAccountName(flowData.fromAccount);
          if (cleanedFromAccount) { // 只有清理后不为空的账户才进行统计
            const isExistingAccount = await checkExistingAccount(flowData.fromAccount, userId);
            if (isExistingAccount) {
              validationResults.stats.existingAccounts++;
              existingAccountNames.add(cleanedFromAccount);
            } else {
              validationResults.stats.newAccounts++;
              newAccountNames.add(cleanedFromAccount);
            }
          }
        }
        if (flowData.toAccount && !accountNames.has(flowData.toAccount)) {
          accountNames.add(flowData.toAccount);
          const cleanedToAccount = cleanAccountName(flowData.toAccount);
          if (cleanedToAccount) { // 只有清理后不为空的账户才进行统计
            const isExistingAccount = await checkExistingAccount(flowData.toAccount, userId);
            if (isExistingAccount) {
              validationResults.stats.existingAccounts++;
              existingAccountNames.add(cleanedToAccount);
            } else {
              validationResults.stats.newAccounts++;
              newAccountNames.add(cleanedToAccount);
            }
          }
        }
      }
      
      // 处理借贷账户
      if (flowData.isLoan && flowData.loanAccountName) {
        if (!accountNames.has(flowData.loanAccountName)) {
          accountNames.add(flowData.loanAccountName);
          const cleanedLoanAccount = cleanAccountName(flowData.loanAccountName);
          if (cleanedLoanAccount) { // 只有清理后不为空的账户才进行统计
            const isExistingAccount = await checkExistingAccount(flowData.loanAccountName, userId);
            if (isExistingAccount) {
              validationResults.stats.existingAccounts++;
              existingAccountNames.add(cleanedLoanAccount);
            } else {
              validationResults.stats.newAccounts++;
              newAccountNames.add(cleanedLoanAccount);
            }
          }
        }
      }
      
      // 验证业务规则
      const businessValidation = validateBusinessRules(flowData, rowNumber);
      if (!businessValidation.isValid) {
        validationResults.warnings.push(...businessValidation.warnings);
      }
      
      validationResults.stats.validRows++;
      
      // 保存所有数据到allData
      validationResults.allData.push({
        row: rowNumber,
        data: flowData,
        original: row,
        editable: true // 标记为可编辑
      });
      
      // 保存样本数据（前10行）用于预览
      if (validationResults.sampleData.length < 10) {
        validationResults.sampleData.push({
          row: rowNumber,
          data: flowData,
          original: row
        });
      }
      
    } catch (error: unknown) {
      console.error(`第${rowNumber}行处理失败:`, error);
      validationResults.errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : String(error),
        data: row
      });
      validationResults.stats.invalidRows++;
    }
  }
  
  // 设置整体验证状态
  validationResults.isValid = validationResults.errors.length === 0;
  
  // 设置账户列表
  validationResults.newAccounts = Array.from(newAccountNames).sort();
  validationResults.existingAccounts = Array.from(existingAccountNames).sort();
  
  console.log('数据验证完成:', {
    totalRows: validationResults.stats.totalRows,
    validRows: validationResults.stats.validRows,
    invalidRows: validationResults.stats.invalidRows,
    duplicateRows: validationResults.stats.duplicateRows,
    newAccounts: validationResults.stats.newAccounts,
    existingAccounts: validationResults.stats.existingAccounts,
    errors: validationResults.errors.length,
    warnings: validationResults.warnings.length,
    isValid: validationResults.isValid
  });
  
  return validationResults;
}

/**
 * 验证流水字段
 */
function validateFlowFields(flowData: any, rowNumber: number): {
  isValid: boolean;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];
  
  // 验证日期
  if (!flowData.day) {
    errors.push({
      row: rowNumber,
      message: '日期不能为空',
      data: null
    });
  } else if (!isValidDate(flowData.day)) {
    errors.push({
      row: rowNumber,
      message: '日期格式不正确',
      data: null
    });
  }
  
  // 验证类型
  if (!flowData.flowType) {
    errors.push({
      row: rowNumber,
      message: '流水类型不能为空',
      data: null
    });
  } else if (!['收入', '支出', '转账', '借入', '借出', '收款', '还款'].includes(flowData.flowType)) {
    errors.push({
      row: rowNumber,
      message: '流水类型必须是：收入、支出、转账、借入、借出、收款或还款',
      data: null
    });
  }
  
  // 验证金额
  if (flowData.money === undefined || flowData.money === null) {
    errors.push({
      row: rowNumber,
      message: '金额不能为空',
      data: null
    });
  } else if (typeof flowData.money !== 'number' || isNaN(flowData.money)) {
    errors.push({
      row: rowNumber,
      message: '金额必须是有效数字',
      data: null
    });
  } else if (flowData.money < 0) {
    errors.push({
      row: rowNumber,
      message: '金额不能为负数',
      data: null
    });
  } else if (flowData.money > 1000000) {
    errors.push({
      row: rowNumber,
      message: '金额过大，请检查数据',
      data: null
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 验证业务规则
 */
function validateBusinessRules(flowData: any, rowNumber: number): {
  isValid: boolean;
  warnings: ValidationWarning[];
} {
  const warnings: ValidationWarning[] = [];
  
  // 检查日期是否在未来
  if (flowData.day && new Date(flowData.day) > new Date()) {
    warnings.push({
      row: rowNumber,
      message: '日期在未来，请检查数据',
      data: null
    });
  }
  
  // 检查日期是否过于久远
  if (flowData.day && new Date(flowData.day) < new Date('2000-01-01')) {
    warnings.push({
      row: rowNumber,
      message: '日期过于久远，请检查数据',
      data: null
    });
  }
  
  // 检查金额是否异常
  if (flowData.money && flowData.money > 0) {
    if (flowData.money < 0.01) {
      warnings.push({
        row: rowNumber,
        message: '金额过小，请检查数据',
        data: null
      });
    }
  }
  
  // 检查账户名称长度
  if (flowData.accountName && flowData.accountName.length > 50) {
    warnings.push({
      row: rowNumber,
      message: '账户名称过长',
      data: null
    });
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  };
}

/**
 * 验证日期格式
 */
function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

/**
 * 检查账户是否已存在
 */
async function checkExistingAccount(accountName: string, userId: number): Promise<boolean> {
  try {
    // 清理账户名称
    const cleanName = cleanAccountName(accountName);
    
    if (!cleanName) {
      return false;
    }
    
    // 查询数据库中的现有账户
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: userId,
        name: cleanName
      }
    });
    
    return !!existingAccount;
  } catch (error) {
    console.error('检查现有账户失败:', error);
    return false;
  }
}

/**
 * 清理账户名称（与AccountImportService保持一致）
 */
function cleanAccountName(name: string): string {
  if (!name) return '';
  
  let cleanName = String(name).trim();
  
  // 移除开头的逗号、空格等无效字符
  cleanName = cleanName.replace(/^[，,、\s]+/, '');
  
  // 移除结尾的逗号、空格等无效字符
  cleanName = cleanName.replace(/[，,、\s]+$/, '');
  
  // 移除数字后缀（如"支付宝总12000" -> "支付宝"）
  cleanName = cleanName.replace(/[总]?\d+\.?\d*$/, '');
  
  // 移除明显的后缀，保留银行名称等关键信息
  cleanName = cleanName.replace(/储蓄卡$|借记卡$|信用卡$|电子钱包$|现金$|微信支付$|银行卡$/g, '');
  
  // 移除多余的空格
  cleanName = cleanName.replace(/\s+/g, ' ');
  
  // 移除特殊字符，但保留中文、英文、数字和空格
  cleanName = cleanName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '');
  
  const result = cleanName.trim();
  
  // 如果清理后为空或只包含无效字符，返回空字符串
  if (!result || result.length === 0) {
    return '';
  }
  
  return result;
}

/**
 * 验证结果接口
 */
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
  metadata: any;
  sampleData: SampleData[];
  allData: SampleData[]; // 添加完整数据字段
  newAccounts: string[]; // 新账户列表
  existingAccounts: string[]; // 已存在账户列表
}

/**
 * 验证错误接口
 */
interface ValidationError {
  row: number;
  message: string;
  data: any;
}

/**
 * 验证警告接口
 */
interface ValidationWarning {
  row: number;
  message: string;
  data: any;
}

/**
 * 验证统计接口
 */
interface ValidationStats {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newAccounts: number;
  existingAccounts: number;
  duplicateRows: number;
}

/**
 * 样本数据接口
 */
interface SampleData {
  row: number;
  data: any;
  original: any[];
  editable?: boolean; // 添加可编辑标记
}
