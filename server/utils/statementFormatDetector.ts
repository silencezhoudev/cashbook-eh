import * as XLSX from "xlsx";
import * as fs from "fs";

/**
 * 支持的账单格式类型
 */
export type StatementFormat = "alipay" | "wxpay" | "jdFinance" | "wacai" | "custom";

/**
 * 格式检测结果
 */
export interface FormatDetectionResult {
  format: StatementFormat;
  titleRowIndex: number;
  headers: Record<string, number>;
  confidence: number; // 0-1，置信度
}

/**
 * 检测文件格式
 * @param filePath 文件路径
 * @returns 格式检测结果
 */
export async function detectStatementFormat(filePath: string): Promise<FormatDetectionResult> {
  const fileExt = filePath.toLowerCase().split(".").pop();
  
  let workbook: XLSX.WorkBook;
  
  // 读取文件
  if (fileExt === "csv") {
    // CSV文件，尝试不同编码
    const buffer = await fs.promises.readFile(filePath);
    const encodings = ["gb2312", "gbk", "utf-8", "utf-8-sig"];
    
    for (const encoding of encodings) {
      try {
        const text = buffer.toString(encoding as BufferEncoding);
        workbook = XLSX.read(text, { type: "string", codepage: 936 });
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!workbook!) {
      throw new Error("无法读取CSV文件，尝试了多种编码");
    }
  } else if (fileExt === "xlsx" || fileExt === "xls") {
    const buffer = await fs.promises.readFile(filePath);
    workbook = XLSX.read(buffer, { type: "buffer" });
  } else {
    throw new Error(`不支持的文件格式: ${fileExt}`);
  }

  // 获取第一个sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const sheetData = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: "",
  });

  // 检测支付宝格式（表头在第25行，索引24）
  const alipayResult = detectAlipayFormat(sheetData);
  if (alipayResult.confidence > 0.6) { // 降低阈值，提高识别率
    return alipayResult;
  }

  // 检测微信格式（表头在第17行，索引16）
  const wxpayResult = detectWxpayFormat(sheetData);
  if (wxpayResult.confidence > 0.6) { // 降低阈值，提高识别率
    return wxpayResult;
  }

  // 检测京东金融格式（表头在第22行，索引21）
  const jdResult = detectJdFinanceFormat(sheetData);
  if (jdResult.confidence > 0.6) { // 降低阈值，提高识别率
    return jdResult;
  }

  // 检测挖财格式
  const wacaiResult = detectWacaiFormat(sheetData);
  if (wacaiResult.confidence > 0.6) { // 降低阈值，提高识别率
    return wacaiResult;
  }

  // 默认返回自定义格式
  return {
    format: "custom",
    titleRowIndex: 0,
    headers: {},
    confidence: 0.5,
  };
}

/**
 * 检测支付宝格式
 */
function detectAlipayFormat(sheetData: any[]): FormatDetectionResult {
  // 尝试多个可能的表头行位置（支付宝表头可能在24行或更早）
  const possibleTitleRows = [24, 23, 22, 25, 26];
  
  let bestResult: FormatDetectionResult | null = null;
  let bestConfidence = 0;

  for (const titleRowIndex of possibleTitleRows) {
    if (sheetData.length <= titleRowIndex) {
      continue;
    }

    const headerRow = sheetData[titleRowIndex];
    if (!Array.isArray(headerRow)) {
      continue;
    }

    // 支付宝关键字段（用于识别格式）
    const alipayKeys = ["交易时间", "收/支", "交易分类", "交易对方", "商品说明", "金额"];
    // 支付宝所有可能的字段（用于构建完整的headers）
    const alipayAllKeys = [
      "交易时间", "收/支", "交易分类", "交易对方", "商品说明", "金额",
      "收/付款方式", "备注", "交易订单号", "商家订单号", "交易状态", "对方账号", "流水归属"
    ];
    const headers: Record<string, number> = {};
    let matchCount = 0;

    headerRow.forEach((cell, index) => {
      if (cell && typeof cell === "string") {
        const cellValue = cell.trim();
        // 关键字段用于计算置信度
        if (alipayKeys.includes(cellValue)) {
          headers[cellValue] = index;
          matchCount++;
        }
        // 所有字段都添加到headers中
        else if (alipayAllKeys.includes(cellValue)) {
          headers[cellValue] = index;
        }
        // 如果不在预定义列表中，也添加到headers中（支持自定义字段）
        else {
          headers[cellValue] = index;
        }
      }
    });

    const confidence = matchCount / alipayKeys.length;
    
    // 如果找到更好的匹配，更新结果
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestResult = {
        format: "alipay",
        titleRowIndex,
        headers,
        confidence,
      };
    }
  }

  // 如果找到了匹配，返回最佳结果
  if (bestResult && bestConfidence > 0) {
    return bestResult;
  }

  // 默认返回第24行的结果（即使置信度较低）
  const titleRowIndex = 24;
  if (sheetData.length > titleRowIndex) {
    const headerRow = sheetData[titleRowIndex];
    if (Array.isArray(headerRow)) {
      const headers: Record<string, number> = {};
      headerRow.forEach((cell, index) => {
        if (cell && typeof cell === "string") {
          headers[cell.trim()] = index;
        }
      });
      // 添加调试日志，查看表头识别情况
      if (headers["流水归属"] !== undefined) {
        console.log("[detectAlipayFormat] 识别到流水归属字段:", {
          titleRowIndex,
          attributionIndex: headers["流水归属"],
          allHeaders: Object.keys(headers).join(", "),
        });
      }
      return {
        format: "alipay",
        titleRowIndex,
        headers,
        confidence: 0.3, // 低置信度，但至少尝试识别
      };
    }
  }

  return { format: "alipay", titleRowIndex: 24, headers: {}, confidence: 0 };
}

/**
 * 检测微信格式
 */
function detectWxpayFormat(sheetData: any[]): FormatDetectionResult {
  // 尝试多个可能的表头行位置（微信表头可能在16行或更早）
  const possibleTitleRows = [16, 15, 14, 17, 18];
  
  let bestResult: FormatDetectionResult | null = null;
  let bestConfidence = 0;

  for (const titleRowIndex of possibleTitleRows) {
    if (sheetData.length <= titleRowIndex) {
      continue;
    }

    const headerRow = sheetData[titleRowIndex];
    if (!Array.isArray(headerRow)) {
      continue;
    }

    // 微信关键字段
    const wxpayKeys = ["交易时间", "收/支", "交易类型", "商品", "金额(元)", "交易对方"];
    const wxpayAllKeys = [
      ...wxpayKeys,
      "支付方式",
      "当前状态",
      "交易单号",
      "商户单号",
      "备注",
      "流水归属",
    ];
    const headers: Record<string, number> = {};
    let matchCount = 0;

    headerRow.forEach((cell, index) => {
      if (cell && typeof cell === "string") {
        const cellValue = cell.trim();
        if (wxpayKeys.includes(cellValue)) {
          headers[cellValue] = index;
          matchCount++;
        } else if (wxpayAllKeys.includes(cellValue)) {
          headers[cellValue] = index;
        }
        // 如果不在预定义列表中，也添加到headers中（支持自定义字段）
        else {
          headers[cellValue] = index;
        }
      }
    });

    const confidence = matchCount / wxpayKeys.length;
    
    // 如果找到更好的匹配，更新结果
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestResult = {
        format: "wxpay",
        titleRowIndex,
        headers,
        confidence,
      };
    }
  }

  // 如果找到了匹配，返回最佳结果
  if (bestResult && bestConfidence > 0) {
    return bestResult;
  }

  // 默认返回第16行的结果（即使置信度较低）
  const titleRowIndex = 16;
  if (sheetData.length > titleRowIndex) {
    const headerRow = sheetData[titleRowIndex];
    if (Array.isArray(headerRow)) {
      const headers: Record<string, number> = {};
      headerRow.forEach((cell, index) => {
        if (cell && typeof cell === "string") {
          headers[cell.trim()] = index;
        }
      });
      return {
        format: "wxpay",
        titleRowIndex,
        headers,
        confidence: 0.3, // 低置信度，但至少尝试识别
      };
    }
  }

  return { format: "wxpay", titleRowIndex: 16, headers: {}, confidence: 0 };
}

/**
 * 检测京东金融格式
 */
function detectJdFinanceFormat(sheetData: any[]): FormatDetectionResult {
  const titleRowIndex = 21; // 京东金融表头在第22行
  if (sheetData.length <= titleRowIndex) {
    return { format: "jdFinance", titleRowIndex, headers: {}, confidence: 0 };
  }

  const headerRow = sheetData[titleRowIndex];
  if (!Array.isArray(headerRow)) {
    return { format: "jdFinance", titleRowIndex, headers: {}, confidence: 0 };
  }

  // 京东金融关键字段
  const jdKeys = ["交易时间", "收/支", "交易分类", "交易说明", "金额", "商户名称"];
  const headers: Record<string, number> = {};
  let matchCount = 0;

  headerRow.forEach((cell, index) => {
    if (cell && typeof cell === "string") {
      const cellValue = cell.trim();
      if (jdKeys.includes(cellValue)) {
        headers[cellValue] = index;
        matchCount++;
      }
    }
  });

  const confidence = matchCount / jdKeys.length;
  return {
    format: "jdFinance",
    titleRowIndex,
    headers,
    confidence,
  };
}

/**
 * 检测挖财格式
 */
function detectWacaiFormat(sheetData: any[]): FormatDetectionResult {
  // 挖财格式通常表头在第一行或第二行
  for (let titleRowIndex = 0; titleRowIndex < Math.min(3, sheetData.length); titleRowIndex++) {
    const headerRow = sheetData[titleRowIndex];
    if (!Array.isArray(headerRow)) {
      continue;
    }

    // 挖财关键字段（根据实际格式调整）
    const wacaiKeys = [
      "日期", "日期时间", "时间",
      "类型", "类别", "分类",
      "金额", "币种",
      "账户", "收付账户", "收支账户", "账户名称",
      "收付款人", "交易对方", "商家",
      "备注", "标签", "属性", "参与人"
    ];
    const headers: Record<string, number> = {};
    let matchCount = 0;

    headerRow.forEach((cell, index) => {
      if (cell && typeof cell === "string") {
        const cellValue = cell.trim();
        // 检查是否包含挖财特征字段
        if (wacaiKeys.some(key => cellValue.includes(key))) {
          headers[cellValue] = index;
          matchCount++;
        }
      }
    });

    if (matchCount >= 3) {
      const denominator = Math.max(
        1,
        Math.min(wacaiKeys.length, headerRow.length || wacaiKeys.length)
      );
      return {
        format: "wacai",
        titleRowIndex,
        headers,
        confidence: matchCount / denominator,
      };
    }
  }

  return { format: "wacai", titleRowIndex: 0, headers: {}, confidence: 0 };
}

