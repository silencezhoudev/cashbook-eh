import * as XLSX from "xlsx";
import * as fs from "fs";
import type { FormatDetectionResult } from "./statementFormatDetector";

/**
 * 流水数据（带元数据）
 */
export interface ParsedFlow {
  day: string;
  flowType: string;
  industryType?: string;
  payType?: string;
  accountId?: number;
  accountName?: string;
  money: number;
  name?: string;
  description?: string;
  goods?: string; // 商品信息（微信：商品列，支付宝：商品说明列）
  attribution?: string;
  // 元数据
  _meta?: {
    isRefund?: boolean; // 是否退款
    isFamilyAccountDuplicate?: boolean; // 是否亲情账户重复
    isPartialRefund?: boolean; // 是否部分退款
    originalRow?: any[]; // 原始行数据
    sourceFile?: string; // 来源文件
    headers?: Record<string, number>; // 表头映射（用于提取原始字段）
    format?: string; // 账单格式（alipay/wxpay等）
    pairId?: string; // 配对ID（用于关联成对的流水）
    relatedFlows?: ParsedFlow[]; // 关联的流水（用于成对显示）
    mergedMoney?: number; // 合并后的金额（部分退款时使用）
    badge?: string; // 前端展示标签
    badgeType?: "info" | "warning" | "success";
    selected?: boolean; // 是否默认选中（用于前端初始化选择状态）
    llmSuggestion?: {
      bookId?: string;
      bookName?: string;
      flowType?: string;
      industryType?: string;
      primaryCategory?: string;
      secondaryCategory?: string;
      attribution?: string;
      description?: string;
      confidence?: number;
      comment?: string;
      ruleId?: number; // 命中的规则ID（来自规则引擎）
    };
    appliedBookId?: string;
  };
}

/**
 * 配对流水（用于内部处理）
 */
export interface PairedFlow {
  id: string; // 配对ID
  type: "refund" | "familyAccount" | "partialRefund" | "fullRefund";
  flows: ParsedFlow[];
  mergedFlow?: ParsedFlow;
  fullyRefunded?: boolean;
}

/**
 * 解析结果
 */
export interface ParseResult {
  displayFlows: ParsedFlow[];
  stats: {
    total: number;
    fullyRefundCount: number;
    partialCount: number;
    familyCount: number;
    refundCount: number;
  };
}

/**
 * 解析文件为原始流水数据（不进行分类处理）
 */
export async function parseStatementFileRaw(
  filePath: string,
  formatResult: FormatDetectionResult
): Promise<ParsedFlow[]> {
  const fileExt = filePath.toLowerCase().split(".").pop();
  let workbook: XLSX.WorkBook;

  // 读取文件
  if (fileExt === "csv") {
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
      throw new Error("无法读取CSV文件");
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
    dateNF: "yyyy-mm-dd",
  });

  // 根据格式解析
  const allFlows: ParsedFlow[] = [];
  const headerRow = sheetData[formatResult.titleRowIndex];
  
  // 跳过表头之前的数据
  const dataRows = sheetData.slice(formatResult.titleRowIndex + 1);

  for (const row of dataRows) {
    if (!Array.isArray(row) || row.length === 0) {
      continue;
    }

    let flow: ParsedFlow | null = null;

    switch (formatResult.format) {
      case "alipay":
        flow = parseAlipayRow(row, formatResult.headers);
        break;
      case "wxpay":
        flow = parseWxpayRow(row, formatResult.headers);
        break;
      case "jdFinance":
        flow = parseJdFinanceRow(row, formatResult.headers);
        break;
      case "wacai":
        flow = parseWacaiRow(row, formatResult.headers);
        break;
      case "custom":
        flow = parseCustomRow(row, formatResult.headers);
        break;
    }

    if (flow) {
      flow._meta = {
        originalRow: row,
        sourceFile: filePath.split("/").pop() || filePath,
        headers: formatResult.headers, // 保存headers信息，用于后续合并时提取字段
        format: formatResult.format, // 保存格式信息
      };
      allFlows.push(flow);
    }
  }

  return allFlows;
}

/**
 * 解析文件为流水数据（包含分类处理）
 */
export async function parseStatementFile(
  filePath: string,
  formatResult: FormatDetectionResult
): Promise<ParseResult> {
  // 先解析原始流水
  const allFlows = await parseStatementFileRaw(filePath, formatResult);
  
  // 标注特殊场景
  const result = categorizeFlows(allFlows);
  return result;
}

/**
 * 解析支付宝行
 */
function parseAlipayRow(row: any[], headers: Record<string, number>): ParsedFlow | null {
  try {
    const day = formatDate(row[headers["交易时间"]]);
    const flowType = String(row[headers["收/支"]] || "").trim();
    const money = parseFloat(String(row[headers["金额"]] || "0").replace(/[￥,]/g, ""));
    const name = String(row[headers["交易对方"]] || "").trim();
    const industryType = String(row[headers["交易分类"]] || "").trim();
    const payType = "支付宝";
    
    const goodsDesc = row[headers["商品说明"]] || "";
    const payMethod = row[headers["收/付款方式"]] || "";
    const accountName =
      typeof payMethod === "string"
        ? payMethod.trim()
        : payMethod !== undefined && payMethod !== null
        ? String(payMethod).trim()
        : "";
    const remark = row[headers["备注"]] || "";
    
    // 将商品说明解析到goods字段
    const goods = typeof goodsDesc === "string" ? goodsDesc.trim() : String(goodsDesc || "").trim();
    
    // description只保留原始备注，不包含支付方式等非备注信息
    const description = typeof remark === "string" ? remark.trim() : String(remark || "").trim();
    
    // 解析流水归属字段
    let attribution: string | undefined = undefined;
    if (headers["流水归属"] !== undefined) {
      const attributionValue = row[headers["流水归属"]];
      if (attributionValue !== undefined && attributionValue !== null && attributionValue !== "") {
        const attributionStr = typeof attributionValue === "string" 
          ? attributionValue.trim() 
          : String(attributionValue).trim();
        if (attributionStr) {
          attribution = attributionStr;
        }
      }
    }
    
    // 添加调试日志，查看流水归属解析情况
    if (attribution) {
      console.log("[parseAlipayRow] 解析到流水归属:", {
        name,
        attribution,
        attributionIndex: headers["流水归属"],
        attributionValue: row[headers["流水归属"]],
        availableHeaders: Object.keys(headers).join(", "),
      });
    }

    // 添加调试日志，查看第一条"不计收支"流水的解析情况
    if (flowType === "不计收支" && (name.includes("慧谷") || industryType === "日用百货")) {
      console.log("[parseAlipayRow] 解析不计收支流水:", {
        flowType,
        name,
        industryType,
        goodsDesc: goodsDesc?.substring(0, 50),
        payMethod: payMethod?.substring(0, 50),
        remark,
        description: description?.substring(0, 100),
        hasPayMethodHeader: headers["收/付款方式"] !== undefined,
        hasAttributionHeader: headers["流水归属"] !== undefined,
        attributionValue: row[headers["流水归属"]],
        attribution,
        availableHeaders: Object.keys(headers).join(", "),
      });
    }

    if (!day || !money || money === 0) {
      return null;
    }

    return {
      day,
      flowType: flowType || (money < 0 ? "支出" : "收入"),
      industryType,
      payType,
      accountName,
      money: Math.abs(money),
      name,
      goods: goods || undefined,
      description: description || undefined,
      attribution: attribution || undefined,
    };
  } catch (e) {
    return null;
  }
}

/**
 * 解析微信行
 */
function parseWxpayRow(row: any[], headers: Record<string, number>): ParsedFlow | null {
  try {
    const day = formatDate(row[headers["交易时间"]]);
    const flowTypeRaw = String(row[headers["收/支"]] || "").trim();
    const flowType = flowTypeRaw === "/" ? "不计收支" : flowTypeRaw;
    const moneyStr = String(row[headers["金额(元)"]] || "0").replace(/[¥,]/g, "");
    const money = parseFloat(moneyStr);
    const goodsRaw =
      headers["商品"] !== undefined ? row[headers["商品"]] : "";
    // 将商品列解析到goods字段
    const goods = typeof goodsRaw === "string" ? goodsRaw.trim() : String(goodsRaw || "").trim();
    
    const counterpartyRaw =
      headers["交易对方"] !== undefined ? row[headers["交易对方"]] : "";
    const resolvedName =
      (typeof counterpartyRaw === "string" ? counterpartyRaw.trim() : String(counterpartyRaw || "").trim()) ||
      (typeof goodsRaw === "string" ? goodsRaw.trim() : String(goodsRaw || "").trim());
    const name = resolvedName;
    const industryType = String(row[headers["交易类型"]] || "").trim();
    const payType = "微信";
    
    const payChannelRaw = row[headers["支付方式"]] || row[headers["支付渠道"]] || "";
    const accountName =
      typeof payChannelRaw === "string"
        ? payChannelRaw.trim()
        : payChannelRaw !== undefined && payChannelRaw !== null
        ? String(payChannelRaw).trim()
        : "";

    const payMethodRaw = headers["支付方式"] !== undefined ? row[headers["支付方式"]] : "";
    const remark = row[headers["备注"]] || "";
    
    // description只保留原始备注，不包含交易对方、支付方式等非备注信息
    const description = typeof remark === "string" ? remark.trim() : String(remark || "").trim();
    
    // 解析流水归属字段
    let attribution: string | undefined = undefined;
    if (headers["流水归属"] !== undefined) {
      const attributionValue = row[headers["流水归属"]];
      if (attributionValue !== undefined && attributionValue !== null && attributionValue !== "") {
        const attributionStr = typeof attributionValue === "string" 
          ? attributionValue.trim() 
          : String(attributionValue).trim();
        if (attributionStr) {
          attribution = attributionStr;
        }
      }
    }
    
    // 添加调试日志，查看流水归属解析情况
    if (attribution) {
      console.log("[parseWxpayRow] 解析到流水归属:", {
        name,
        attribution,
        attributionIndex: headers["流水归属"],
        attributionValue: row[headers["流水归属"]],
        availableHeaders: Object.keys(headers).join(", "),
      });
    }

    if (!day || !money || money === 0) {
      return null;
    }

    return {
      day,
      flowType: flowType || (money < 0 ? "支出" : "收入"),
      industryType,
      payType,
      accountName,
      money: Math.abs(money),
      name,
      goods: goods || undefined,
      description: description || undefined,
      attribution: attribution || undefined,
    };
  } catch (e) {
    return null;
  }
}

/**
 * 解析京东金融行
 */
function parseJdFinanceRow(row: any[], headers: Record<string, number>): ParsedFlow | null {
  try {
    const day = formatDate(row[headers["交易时间"]]);
    const flowType = String(row[headers["收/支"]] || "").trim();
    const moneyStr = String(row[headers["金额"]] || "0");
    const match = moneyStr.match(/^(\d*\.?\d+)/);
    const money = match ? parseFloat(match[1]) : parseFloat(moneyStr.replace(/[￥,]/g, ""));
    const name = String(row[headers["交易说明"]] || "").trim();
    const industryType = String(row[headers["交易分类"]] || "").trim();
    const payType = "京东金融";
    
    const desc = match ? moneyStr.substring(match[0].length) : "";
    const payMethodRaw = row[headers["收/付款方式"]] || "";
    const accountName =
      typeof payMethodRaw === "string"
        ? payMethodRaw.trim()
        : payMethodRaw !== undefined && payMethodRaw !== null
        ? String(payMethodRaw).trim()
        : "";
    const description = [
      desc,
      row[headers["商户名称"]] || "",
      payMethodRaw || "",
      row[headers["备注"]] || "",
    ]
      .filter(Boolean)
      .join("-");

    if (!day || !money || money === 0) {
      return null;
    }

    return {
      day,
      flowType: flowType || (money < 0 ? "支出" : "收入"),
      industryType,
      payType,
      accountName,
      money: Math.abs(money),
      name,
      description,
    };
  } catch (e) {
    return null;
  }
}

/**
 * 根据账户名称推断支付方式
 */
function inferPayTypeFromAccountName(accountName: string | undefined | null): string {
  if (!accountName || typeof accountName !== "string") {
    return "";
  }
  
  const account = accountName.trim();
  
  // 支付宝相关
  if (account.includes("支付宝") || account.includes("余额宝") || account.includes("花呗")) {
    return "支付宝";
  }
  
  // 微信相关
  if (account.includes("微信") || account.includes("零钱") || account.includes("财付通")) {
    return "微信";
  }
  
  // 现金
  if (account.includes("现金")) {
    return "现金";
  }
  
  // 银行卡相关（常见银行）
  const bankKeywords = [
    "建设银行", "工商银行", "农业银行", "中国银行", "交通银行",
    "招商银行", "浦发银行", "民生银行", "兴业银行", "光大银行",
    "华夏银行", "中信银行", "平安银行", "广发银行", "邮储银行",
    "储蓄卡", "借记卡", "信用卡", "银行卡"
  ];
  
  for (const keyword of bankKeywords) {
    if (account.includes(keyword)) {
      return "银行卡";
    }
  }
  
  // 其他情况返回空字符串，让系统自动识别
  return "";
}

/**
 * 解析挖财行（简化版，需要根据实际格式调整）
 */
function parseWacaiRow(row: any[], headers: Record<string, number>): ParsedFlow | null {
  try {
    const headerKeys = Object.keys(headers);
    const findHeader = (keywords: string[]): string | undefined => {
      return headerKeys.find(key => keywords.some(keyword => key.includes(keyword)));
    };

    const getValue = (keywords: string[]): any => {
      const key = findHeader(keywords);
      if (key === undefined) {
        return undefined;
      }
      return row[headers[key]];
    };

    const dayRaw = getValue(["日期时间", "日期", "时间"]);
    const amountRaw = getValue(["金额"]);
    if (!dayRaw || amountRaw === undefined || amountRaw === null) {
      return null;
    }

    const day = formatDate(dayRaw);
    const money = parseFloat(String(amountRaw).replace(/[￥,]/g, ""));
    if (!day || Number.isNaN(money) || money === 0) {
      return null;
    }

    const typeRaw = getValue(["类型", "流水类型", "收支"]);
    const categoryRaw = getValue(["分类", "类别"]);
    const counterpartyRaw = getValue(["收付款人", "交易对方", "商家"]);
    const accountRaw = getValue(["收付账户", "账户", "账户名称", "账户名", "收支账户"]);
    const remarkRaw = getValue(["备注", "说明"]);
    const tagRaw = getValue(["标签"]);
    const participantRaw = getValue(["参与人"]);

    const description = [remarkRaw, tagRaw, participantRaw]
      .map(value => {
        if (value === undefined || value === null) {
          return "";
        }
        const strValue = typeof value === "string" ? value : String(value);
        return strValue.trim();
      })
      .filter(Boolean)
      .join(" | ");

    // 解析账户名称
    const accountName = typeof accountRaw === "string" ? accountRaw.trim() : "";
    
    // 根据账户名称推断支付方式
    const payType = inferPayTypeFromAccountName(accountName);

    return {
      day,
      flowType: (typeof typeRaw === "string" && typeRaw.trim()) || (money < 0 ? "支出" : "收入"),
      industryType: typeof categoryRaw === "string" ? categoryRaw.trim() : "",
      payType,
      accountName,
      money: Math.abs(money),
      name: typeof counterpartyRaw === "string" ? counterpartyRaw.trim() : "",
      description,
    };
  } catch (e) {
    return null;
  }
}

/**
 * 解析自定义格式行
 */
function parseCustomRow(row: any[], headers: Record<string, number>): ParsedFlow | null {
  // 自定义格式尝试通用字段映射
  try {
    const dayKey = Object.keys(headers).find(k => 
      k.includes("时间") || k.includes("日期") || k.toLowerCase().includes("date")
    );
    const moneyKey = Object.keys(headers).find(k => 
      k.includes("金额") || k.toLowerCase().includes("amount") || k.toLowerCase().includes("money")
    );
    const typeKey = Object.keys(headers).find(k => 
      k.includes("类型") || k.includes("收支") || k.toLowerCase().includes("type")
    );
    const nameKey = Object.keys(headers).find(k => 
      k.includes("交易对方") || k.includes("对方") || k.includes("商户") || k.includes("商家") || 
      k.includes("商品") || k.toLowerCase().includes("name") || k.toLowerCase().includes("merchant")
    );
    const accountKey = Object.keys(headers).find(k => 
      k.includes("支付方式") || k.includes("付款方式") || k.includes("收/付款方式") || 
      k.includes("账户") || k.includes("渠道") || k.toLowerCase().includes("account") || 
      k.toLowerCase().includes("payment")
    );
    const descKey = Object.keys(headers).find(k => 
      k.includes("备注") || k.includes("说明") || k.includes("描述") || 
      k.includes("商品说明") || k.toLowerCase().includes("description") || k.toLowerCase().includes("remark")
    );
    const industryKey = Object.keys(headers).find(k => 
      k.includes("分类") || k.includes("类别") || k.includes("交易分类") || 
      k.toLowerCase().includes("category") || k.toLowerCase().includes("industry")
    );

    if (!dayKey || !moneyKey) {
      return null;
    }

    const day = formatDate(row[headers[dayKey]]);
    const money = parseFloat(String(row[headers[moneyKey]] || "0").replace(/[￥,]/g, ""));
    const flowType = typeKey ? String(row[headers[typeKey]] || "").trim() : "";
    const name = nameKey ? String(row[headers[nameKey]] || "").trim() : "";
    const accountName = accountKey ? String(row[headers[accountKey]] || "").trim() : "";
    const description = descKey ? String(row[headers[descKey]] || "").trim() : "";
    const industryType = industryKey ? String(row[headers[industryKey]] || "").trim() : "";

    if (!day || !money || money === 0) {
      return null;
    }

    // 根据账户名称推断支付方式
    const payType = inferPayTypeFromAccountName(accountName) || 
                    (accountName ? "" : ""); // 如果有账户名但没有匹配到支付方式，保留空字符串

    return {
      day,
      flowType: flowType || (money < 0 ? "支出" : "收入"),
      money: Math.abs(money),
      name: name || undefined,
      accountName: accountName || undefined,
      description: description || undefined,
      industryType: industryType || undefined,
      payType: payType || undefined,
    };
  } catch (e) {
    return null;
  }
}

/**
 * 格式化日期
 */
function formatDate(dateValue: any): string | null {
  if (!dateValue) {
    return null;
  }

  if (typeof dateValue === "string") {
    // 尝试解析字符串日期
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
    // 尝试匹配 YYYY-MM-DD 格式
    const match = dateValue.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return null;
  }

  if (typeof dateValue === "number") {
    // Excel日期数字
    const excelStartDate = new Date(1899, 11, 30);
    const resultDate = new Date(excelStartDate);
    resultDate.setDate(resultDate.getDate() + dateValue);
    resultDate.setHours(resultDate.getHours() + 8); // 时区偏移
    return resultDate.toISOString().split("T")[0];
  }

  if (dateValue instanceof Date) {
    return dateValue.toISOString().split("T")[0];
  }

  return null;
}

/**
 * 分类流水：识别退款、亲情账户、部分退款，并进行配对和合并
 * 
 * 特殊流水处理逻辑（需保留）：
 * 1. 退款流水（isRefundFlow）：识别并配对原支出流水
 *    - 全额退款：显示两条原始流水，默认不选
 *    - 部分退款：合并为一条流水，金额为支出-退款
 * 2. 亲情账户流水（isFamilyAccountFlow）：识别并合并亲情代付流水
 *    - 配对"支出"和"不计收支"两条流水
 *    - 合并为一条支出流水，使用"不计收支"的交易对方和分类信息
 * 
 * 此函数在 parseStatementFile 中被调用，返回处理后的 displayFlows
 * 这些特殊流水会在前端展示时带有特殊标识（badge）
 */
export function categorizeFlows(flows: ParsedFlow[]): ParseResult {
  const normalFlows: ParsedFlow[] = [];
  const refundCandidates: ParsedFlow[] = [];
  const familyAccountCandidates: ParsedFlow[] = [];

  // 第一步：识别特殊流水（按优先级：亲情 -> 退款）
  for (const flow of flows) {
    // 添加调试日志，查看每条流水的信息
    if (flow.payType === "支付宝" && (flow.flowType === "不计收支" || flow.flowType === "支出")) {
      console.log("[识别前检查] 流水:", {
        flowType: flow.flowType,
        name: flow.name,
        industryType: flow.industryType,
        description: flow.description?.substring(0, 100), // 只显示前100个字符
        isFamilyAccount: isFamilyAccountFlow(flow),
      });
    }
    
    if (isFamilyAccountFlow(flow)) {
      flow._meta = flow._meta || {};
      flow._meta.isFamilyAccountDuplicate = true;
      familyAccountCandidates.push(flow);
      console.log("[识别亲情账户流水] 识别到:", {
        flowType: flow.flowType,
        name: flow.name,
        industryType: flow.industryType,
        description: flow.description?.substring(0, 100),
      });
      continue;
    }

    if (isRefundFlow(flow)) {
      flow._meta = flow._meta || {};
      flow._meta.isRefund = true;
      refundCandidates.push(flow);
      continue;
    }

    normalFlows.push(flow);
  }
  
  console.log("[识别亲情账户流水] 总共识别到", familyAccountCandidates.length, "条亲情账户流水");

  const pairedExpenses = new Set<ParsedFlow>();

  const {
    refundPairs,
    partialPairs,
    fullRefundPairs,
  } = pairRefunds(refundCandidates, flows, pairedExpenses);

  const familyPairs = pairAndMergeFamilyAccount(
    familyAccountCandidates,
    flows,
    pairedExpenses
  );

  // 过滤掉已配对的支出
  const filteredNormalFlows = normalFlows.filter((flow) => !pairedExpenses.has(flow));

  const displayFlows: ParsedFlow[] = [];

  filteredNormalFlows.forEach((flow) => {
    displayFlows.push(flow);
  });

  // 处理全额退款：显示两条原始流水，都默认不选
  fullRefundPairs.forEach((pair) => {
    // 显示两条原始流水（原支出和退款），都标记为默认不选
    pair.flows.forEach((flow) => {
      flow._meta = {
        ...flow._meta,
        badge: "退款",
        badgeType: "info",
        selected: false, // 全额退款的两条都默认不选
      };
      displayFlows.push(flow);
    });
  });

  partialPairs.forEach((pair) => {
    if (pair.mergedFlow) {
      pair.mergedFlow._meta = {
        ...pair.mergedFlow._meta,
        badge: "部分退款",
        badgeType: "warning",
      };
      displayFlows.push(pair.mergedFlow);
    } else {
      pair.flows.forEach((flow) => {
        flow._meta = {
          ...flow._meta,
          badge: "部分退款",
          badgeType: "warning",
        };
        displayFlows.push(flow);
      });
    }
  });

  familyPairs.forEach((pair) => {
    // 显示两条原始流水（支出和不计收支），原"支出"那条默认不选
    pair.flows.forEach((flow) => {
      const isExpenseFlow = flow.flowType === "支出";
      const normalizedFlow =
        isExpenseFlow || flow.flowType !== "不计收支"
          ? flow
          : {
              ...flow,
              flowType: "支出", // 亲情代付展示时统一为支出
            };

      normalizedFlow._meta = {
        ...normalizedFlow._meta,
        badge: "亲情代付",
        badgeType: "info",
        selected: !isExpenseFlow, // 原"支出"那条默认不选，其他默认选中
      };
      displayFlows.push(normalizedFlow);
    });
  });

  refundPairs.forEach((pair) => {
    pair.flows.forEach((flow) => {
      flow._meta = {
        ...flow._meta,
        badge: "退款",
        badgeType: "info",
      };
      displayFlows.push(flow);
    });
  });

  const stats = {
    total: displayFlows.length,
    fullyRefundCount: fullRefundPairs.length,
    partialCount: partialPairs.length,
    familyCount: familyPairs.length,
    refundCount: refundPairs.length,
  };

  return {
    displayFlows,
    stats,
  };
}

/**
 * 检测是否为退款流水
 */
function isRefundFlow(flow: ParsedFlow): boolean {
  // 1. 交易类型包含"退款"
  if (flow.flowType && /退款/.test(flow.flowType)) {
    return true;
  }

  // 2. 行业类型包含"退款"
  if (flow.industryType && /退款/.test(flow.industryType)) {
    return true;
  }

  // 3. 描述中包含退款关键词
  const refundKeywords = ["退款", "退货", "已全额退款", "已退款", "退款成功"];
  const desc = (flow.description || "").toLowerCase();
  if (refundKeywords.some(keyword => desc.includes(keyword.toLowerCase()))) {
    return true;
  }

  // 4. 收入类型且金额为正（可能是退款）
  if (flow.flowType === "收入" && flow.money > 0) {
    // 进一步检查描述
    if (desc.includes("退款") || desc.includes("退货")) {
      return true;
    }
  }

  return false;
}

/**
 * 检测是否为亲情账户流水
 */
function isFamilyAccountFlow(flow: ParsedFlow): boolean {
  // 1. 微信的亲属卡交易
  if (flow.payType === "微信") {
    const desc = (flow.description || "").toLowerCase();
    const name = (flow.name || "").toLowerCase();
    
    if (
      /亲属卡/.test(desc) ||
      /亲属卡/.test(name) ||
      /亲情账户/.test(desc) ||
      /亲情账户/.test(name)
    ) {
      return true;
    }
  }

  // 2. 支付宝的亲友代付
  if (flow.payType === "支付宝") {
    const industryType = (flow.industryType || "").toLowerCase();
    const desc = (flow.description || "").toLowerCase();
    const name = (flow.name || "").toLowerCase();
    
    const hasIndustryType = /亲友代付/.test(industryType);
    const hasDesc1 = /亲友代付/.test(desc);
    const hasDesc2 = /亲情账户/.test(desc);
    const hasDesc3 = /亲情卡/.test(desc);
    const hasName = /亲情卡/.test(name);
    
    // 添加调试日志
    if (flow.flowType === "不计收支" || flow.flowType === "支出") {
      console.log("[isFamilyAccountFlow] 检查支付宝流水:", {
        flowType: flow.flowType,
        industryType,
        desc: desc.substring(0, 100),
        name,
        hasIndustryType,
        hasDesc1,
        hasDesc2,
        hasDesc3,
        hasName,
        result: hasIndustryType || hasDesc1 || hasDesc2 || hasDesc3 || hasName,
      });
    }
    
    if (
      hasIndustryType ||
      hasDesc1 ||
      hasDesc2 ||
      hasDesc3 ||
      hasName
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 配对退款流水（原支出 + 退款），并识别部分退款和全额退款
 */
function pairRefunds(
  refunds: ParsedFlow[],
  allFlows: ParsedFlow[],
  pairedExpenses: Set<ParsedFlow>
): {
  refundPairs: PairedFlow[];
  partialPairs: PairedFlow[];
  fullRefundPairs: PairedFlow[];
} {
  const refundPairs: PairedFlow[] = [];
  const partialPairs: PairedFlow[] = [];
  const fullRefundPairs: PairedFlow[] = [];

  for (let i = 0; i < refunds.length; i++) {
    const refund = refunds[i];
    const pairId = `refund_${i}_${Date.now()}`;
    console.log("[pairRefunds] 处理退款流水", {
      pairId,
      refundDay: refund.day,
      refundMoney: refund.money,
      refundName: refund.name,
      refundType: refund.industryType,
      refundDesc: refund.description,
      refundFormat: refund._meta?.format,
      refundStatus: extractFieldFromRow(refund, "当前状态"),
    });

    const matchedExpense = findMatchingExpense(refund, allFlows, pairedExpenses);
    console.log("[pairRefunds] 匹配结果", {
      pairId,
      matched: !!matchedExpense,
      matchedDay: matchedExpense?.day,
      matchedMoney: matchedExpense?.money,
      matchedName: matchedExpense?.name,
      matchedDesc: matchedExpense?.description,
      matchedFormat: matchedExpense?._meta?.format,
      matchedStatus: matchedExpense ? extractFieldFromRow(matchedExpense, "当前状态") : undefined,
    });

    if (matchedExpense) {
      matchedExpense._meta = matchedExpense._meta || {};
      matchedExpense._meta.pairId = pairId;
      refund._meta = refund._meta || {};
      refund._meta.pairId = pairId;
      pairedExpenses.add(matchedExpense);

      const diff = Number((matchedExpense.money - refund.money).toFixed(2));
      const isFullyRefund = Math.abs(diff) <= 0.01;

      if (isFullyRefund) {
        // 全额退款：保留原支出数据
        fullRefundPairs.push({
          id: pairId,
          type: "fullRefund",
          flows: [matchedExpense, refund],
          mergedFlow: matchedExpense, // 使用原支出数据
          fullyRefunded: true,
        });
      } else if (diff > 0) {
        // 部分退款：生成合并后的流水，金额为支出-退款
        const mergedFlow: ParsedFlow = {
          ...matchedExpense,
          money: diff,
          description: `${matchedExpense.description || ""} [部分退款: -${refund.money}元]`.trim(),
          _meta: {
            ...matchedExpense._meta,
            pairId,
            relatedFlows: [refund],
            mergedMoney: diff,
          },
        };

        partialPairs.push({
          id: pairId,
          type: "partialRefund",
          flows: [matchedExpense, refund],
          mergedFlow,
        });
      } else {
        // 退款金额大于支出，仍然按退款展示
        refundPairs.push({
          id: pairId,
          type: "refund",
          flows: [refund],
        });
      }
    } else {
      // 未找到原支出，保留退款流水
      refundPairs.push({
        id: pairId,
        type: "refund",
        flows: [refund],
      });
    }
  }

  return { refundPairs, partialPairs, fullRefundPairs };
}

/**
 * 配对并合并亲情账户流水（两条合并成一条）
 */
function pairAndMergeFamilyAccount(
  familyFlows: ParsedFlow[],
  allFlows: ParsedFlow[],
  pairedExpenses: Set<ParsedFlow>
): PairedFlow[] {
  const pairs: PairedFlow[] = [];
  const processedFamilyFlows = new Set<ParsedFlow>();

  for (let i = 0; i < familyFlows.length; i++) {
    const familyFlow = familyFlows[i];
    
    // 如果已经处理过，跳过
    if (processedFamilyFlows.has(familyFlow)) {
      continue;
    }
    
    const pairId = `family_${i}_${Date.now()}`;
    
    // 根据 flowType 决定配对逻辑
    let baseFlow: ParsedFlow; // 作为基础数据的流水（应该是"不计收支"）
    let expenseFlow: ParsedFlow | null = null; // 作为支出数据的流水（应该是"支出"）
    
    if (familyFlow.flowType === "不计收支") {
      // 当前是"不计收支"，查找匹配的"支出"流水
      baseFlow = familyFlow;
      expenseFlow = findMatchingExpense(familyFlow, allFlows, pairedExpenses);
    } else if (familyFlow.flowType === "支出") {
      // 当前是"支出"，尝试查找匹配的"不计收支"流水
      // 但通常"不计收支"那条应该也被识别为亲情账户流水，所以应该在 familyFlows 中
      const matchedNonExpense = findMatchingNonExpense(familyFlow, familyFlows, processedFamilyFlows);
      if (matchedNonExpense) {
        baseFlow = matchedNonExpense;
        expenseFlow = familyFlow;
        processedFamilyFlows.add(matchedNonExpense);
      } else {
        // 如果找不到匹配的"不计收支"，使用当前"支出"作为基础（这种情况不应该发生）
        baseFlow = familyFlow;
        expenseFlow = null;
      }
    } else {
      // 其他情况，直接使用当前流水作为基础
      baseFlow = familyFlow;
      expenseFlow = findMatchingExpense(familyFlow, allFlows, pairedExpenses);
    }
    
    processedFamilyFlows.add(familyFlow);
    
    if (expenseFlow) {
      expenseFlow._meta = expenseFlow._meta || {};
      expenseFlow._meta.pairId = pairId;
      pairedExpenses.add(expenseFlow);
    }
    
    baseFlow._meta = baseFlow._meta || {};
    baseFlow._meta.pairId = pairId;

    // 添加调试日志
    console.log("[亲情账户合并] baseFlow:", {
      flowType: baseFlow.flowType,
      name: baseFlow.name,
      industryType: baseFlow.industryType,
      nameFromRow: extractFieldFromRow(baseFlow, "交易对方"),
    });
    if (expenseFlow) {
      console.log("[亲情账户合并] expenseFlow:", {
        flowType: expenseFlow.flowType,
        name: expenseFlow.name,
        industryType: expenseFlow.industryType,
      });
    }

    const mergedFlow = buildFamilyMergedFlow(expenseFlow, baseFlow, pairId);
    
    console.log("[亲情账户合并] mergedFlow:", {
      flowType: mergedFlow.flowType,
      name: mergedFlow.name,
      industryType: mergedFlow.industryType,
    });

    pairs.push({
      id: pairId,
      type: "familyAccount",
      flows: expenseFlow ? [expenseFlow, baseFlow] : [baseFlow],
      mergedFlow,
    });
  }

  return pairs;
}

/**
 * 查找匹配的"不计收支"流水（用于当当前是"支出"时）
 */
function findMatchingNonExpense(
  targetFlow: ParsedFlow,
  familyFlows: ParsedFlow[],
  processedFlows: Set<ParsedFlow>
): ParsedFlow | null {
  for (const flow of familyFlows) {
    if (processedFlows.has(flow)) continue;
    if (flow === targetFlow) continue;
    if (flow.flowType !== "不计收支") continue;

    const nameMatch = isFamilyFieldMatch(flow.name, targetFlow.name);
    const descMatch = isFamilyFieldMatch(flow.description, targetFlow.description);

    if (!nameMatch && !descMatch) continue;

    const dateDiff = getDateDiff(flow.day, targetFlow.day);
    if (dateDiff === null || dateDiff > 30) continue;

    const amountDiff = Math.abs(flow.money - targetFlow.money);
    if (amountDiff > 0.01) continue;

    return flow;
  }
  return null;
}

/**
 * 查找匹配的支出流水
 */
function findMatchingExpense(
  targetFlow: ParsedFlow,
  allFlows: ParsedFlow[],
  pairedExpenses: Set<ParsedFlow>
): ParsedFlow | null {
  let bestMatch: ParsedFlow | null = null;
  let bestScore = Number.MAX_SAFE_INTEGER;

  for (const flow of allFlows) {
    if (flow === targetFlow) continue;
    if (pairedExpenses.has(flow)) continue;
    if (flow.flowType !== "支出") continue;

    const nameMatch = isFamilyFieldMatch(flow.name, targetFlow.name);
    const descMatch = isFamilyFieldMatch(flow.description, targetFlow.description);
    const relaxedWxpayMatch = isRelaxedWxpayFullRefundMatch(targetFlow, flow);

    if (!nameMatch && !descMatch && !relaxedWxpayMatch) continue;

    const dateDiff = getDateDiff(flow.day, targetFlow.day);
    if (dateDiff === null || dateDiff > 30) continue;

    const amountDiff = Math.abs(flow.money - targetFlow.money);
    const penalty = nameMatch ? 0 : descMatch ? 20 : relaxedWxpayMatch ? 80 : 50;
    const score = dateDiff * 100 + amountDiff + penalty;
    if (score < bestScore) {
      bestMatch = flow;
      bestScore = score;
    }
  }

  return bestMatch;
}

function isRelaxedWxpayFullRefundMatch(targetFlow: ParsedFlow, expenseFlow: ParsedFlow): boolean {
  if (!targetFlow?._meta?.isRefund) return false;
  if (targetFlow._meta?.format !== "wxpay") return false;
  if (expenseFlow._meta?.format !== "wxpay") return false;

  const refundStatus = extractFieldFromRow(targetFlow, "当前状态") || "";
  const expenseStatus = extractFieldFromRow(expenseFlow, "当前状态") || "";
  const isFullRefundStatus =
    refundStatus.includes("已全额退款") && expenseStatus.includes("已全额退款");

  if (!isFullRefundStatus) {
    console.log("[isRelaxedWxpayFullRefundMatch] 状态未匹配", {
      refundStatus,
      expenseStatus,
    });
    return false;
  }

  // 仅放宽匹配给金额一致、退款流水（行业类型包含退款）
  const refundType = targetFlow.industryType || "";
  if (!/退款/.test(refundType)) {
    console.log("[isRelaxedWxpayFullRefundMatch] 行业类型不包含退款", {
      refundType,
    });
    return false;
  }

  console.log("[isRelaxedWxpayFullRefundMatch] 命中放宽匹配", {
    refundName: targetFlow.name,
    expenseName: expenseFlow.name,
    refundDesc: targetFlow.description,
    expenseDesc: expenseFlow.description,
  });
  return true;
}

function isFamilyFieldMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const normA = cleanFamilyText(a).toLowerCase();
  const normB = cleanFamilyText(b).toLowerCase();
  if (!normA || !normB) return false;
  return normA.includes(normB) || normB.includes(normA);
}

function getDateDiff(date1: string, date2: string): number | null {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d1.getTime() - d2.getTime());
    return diffTime / (1000 * 60 * 60 * 24);
  } catch {
    return null;
  }
}

/**
 * 从原始行数据中提取字段值
 */
function extractFieldFromRow(
  flow: ParsedFlow,
  fieldName: string
): string | undefined {
  if (!flow._meta?.originalRow || !flow._meta?.headers) {
    console.log(`[extractFieldFromRow] 缺少原始数据: fieldName=${fieldName}, hasOriginalRow=${!!flow._meta?.originalRow}, hasHeaders=${!!flow._meta?.headers}`);
    return undefined;
  }
  const headers = flow._meta.headers;
  const colIndex = headers[fieldName];
  if (colIndex === undefined) {
    console.log(`[extractFieldFromRow] 字段不存在: fieldName=${fieldName}, availableHeaders=${Object.keys(headers).join(", ")}`);
    return undefined;
  }
  const value = flow._meta.originalRow[colIndex];
  const result = value ? String(value).trim() : undefined;
  console.log(`[extractFieldFromRow] 提取字段: fieldName=${fieldName}, colIndex=${colIndex}, value=${value}, result=${result}`);
  return result;
}

function buildFamilyMergedFlow(
  expense: ParsedFlow | null,
  familyFlow: ParsedFlow,
  pairId: string
): ParsedFlow {
  // 以"不计收支"那条（familyFlow）作为基础
  // 注意：familyFlow应该是flowType为"不计收支"的流水
  const base = familyFlow;
  
  // 直接从"不计收支"那条的原始行数据提取"交易对方"字段（确保使用正确的数据）
  const familyNameFromRow = extractFieldFromRow(familyFlow, "交易对方");
  const familyNameFromRow2 = extractFieldFromRow(familyFlow, "商品");
  const familyNameRaw = familyNameFromRow || familyNameFromRow2 || familyFlow.name;
  const cleanedFamilyName = cleanFamilyText(familyNameRaw);
  
  console.log("[buildFamilyMergedFlow] 提取交易对方:", {
    familyNameFromRow,
    familyNameFromRow2,
    familyFlowName: familyFlow.name,
    familyNameRaw,
    cleanedFamilyName,
  });
  
  // 直接从"不计收支"那条的原始行数据提取"交易分类"字段
  const familyIndustryFromRow = extractFieldFromRow(familyFlow, "交易分类");
  const familyIndustryFromRow2 = extractFieldFromRow(familyFlow, "交易类型");
  const familyIndustryRaw = familyIndustryFromRow || familyIndustryFromRow2 || familyFlow.industryType;
  const cleanedFamilyIndustry = cleanFamilyText(familyIndustryRaw);
  
  console.log("[buildFamilyMergedFlow] 提取交易分类:", {
    familyIndustryFromRow,
    familyIndustryFromRow2,
    familyFlowIndustryType: familyFlow.industryType,
    familyIndustryRaw,
    cleanedFamilyIndustry,
  });
  
  // 从"支出"那条提取需要替换的字段
  let expensePayMethod: string | undefined; // 收/付款方式
  let expenseOrderId: string | undefined; // 交易订单号
  let expenseFlowType: string | undefined; // 收/支
  
  if (expense && expense.flowType === "支出") {
    // 提取"收/付款方式"（支付宝）或"支付方式"（微信）
    expensePayMethod = 
      extractFieldFromRow(expense, "收/付款方式") ||
      extractFieldFromRow(expense, "支付方式");
    
    // 提取"交易订单号"
    expenseOrderId = 
      extractFieldFromRow(expense, "交易订单号") ||
      extractFieldFromRow(expense, "交易单号");
    
    // 使用"支出"那条的flowType
    expenseFlowType = expense.flowType;
  }
  
  // 从"不计收支"那条提取商品信息，保存到goods字段
  const familyGoodsDesc = extractFieldFromRow(familyFlow, "商品说明") || 
                          extractFieldFromRow(familyFlow, "商品") ||
                          familyFlow.goods;
  const familyGoods = familyGoodsDesc ? String(familyGoodsDesc).trim() : undefined;
  
  const familyRemark = extractFieldFromRow(familyFlow, "备注");
  
  // 重新构建description：使用"不计收支"的备注，但"收/付款方式"和"交易订单号"用"支出"那条的（商品信息不再放入description）
  const descriptionParts: string[] = [];
  if (expensePayMethod) descriptionParts.push(expensePayMethod);
  if (expenseOrderId) descriptionParts.push(`订单号:${expenseOrderId}`);
  if (familyRemark) descriptionParts.push(familyRemark);
  const mergedDescription = descriptionParts.length > 0 
    ? descriptionParts.join("-") 
    : cleanFamilyText(familyFlow.description);
  
  // 确定最终的flowType：如果有匹配的支出流水，使用"支出"；如果基础流水是"不计收支"，也改为"支出"（亲情账户代付应该记录为支出）
  let finalFlowType: string;
  if (expenseFlowType === "支出") {
    finalFlowType = "支出";
  } else if (familyFlow.flowType === "不计收支") {
    finalFlowType = "支出"; // 亲情账户代付应该记录为支出
  } else {
    finalFlowType = expenseFlowType || familyFlow.flowType;
  }
  
  return {
    ...base,
    name: cleanedFamilyName || familyNameRaw || familyFlow.name, // 确保有值，优先使用清洗后的，否则用原始值
    industryType: cleanedFamilyIndustry || familyIndustryRaw || familyFlow.industryType || undefined,
    goods: familyGoods || base.goods, // 使用提取的商品信息，如果没有则使用基础流水的goods
    description: mergedDescription,
    flowType: finalFlowType, // 确保显示为"支出"
    payType: expense?.payType || familyFlow.payType, // 保持payType（支付宝/微信等）
    _meta: {
      ...base._meta,
      pairId,
      relatedFlows: expense ? [familyFlow] : undefined,
      // 如果提取到了订单号，保存到_meta中（如果需要的话可以后续使用）
      ...(expenseOrderId && { orderId: expenseOrderId }),
    },
  };
}

function cleanFamilyText(text?: string): string {
  if (!text) return "";
  return text
    .replace(/亲情账户|亲属卡|亲友代付|代付/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

