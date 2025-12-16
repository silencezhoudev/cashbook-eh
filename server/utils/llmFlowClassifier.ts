import prisma from "~/lib/prisma";
import type { ParsedFlow } from "./flowParser";

interface BookSummary {
  bookId: string;
  bookName: string;
  description?: string | null;
  flowTypes: string[];
  primaryCategories: string[];
  secondaryCategories: string[];
}

interface LlmSuggestion {
  index: number;
  bookId?: string;
  flowType?: string;
  industryType?: string;
  primaryCategory?: string;
  secondaryCategory?: string;
  attribution?: string;
  description?: string;
  confidence?: number;
  comment?: string;
}

interface BookSuggestion {
  index: number;
  bookId?: string;
  confidence?: number;
  comment?: string;
}

interface CategorySuggestion {
  index: number;
  flowType?: string;
  industryType?: string;
  primaryCategory?: string;
  secondaryCategory?: string;
  attribution?: string;
  description?: string;
  confidence?: number;
  comment?: string;
}

interface ApplyLlmSuggestionsOptions {
  userId: number;
  candidateBookIds?: string[];
  batchSize?: number;
  onBatchProgress?: (info: {
    stage: "book" | "category";
    stats: BatchStats;
  }) => void;
}

export interface LlmBatchInfo {
  stage: "book" | "category";
  batchSize: number;
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  lastBatchSize: number;
}

const DEFAULT_BATCH_SIZE = Number(process.env.LLM_BATCH_SIZE || 3);

interface BatchStats {
  batchSize: number;
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  lastBatchSize: number;
}

const emptyBatchStats = (batchSize: number): BatchStats => ({
  batchSize,
  totalBatches: 0,
  completedBatches: 0,
  failedBatches: 0,
  lastBatchSize: 0,
});

const buildLlmBatchInfo = (
  stage: LlmBatchInfo["stage"],
  stats: BatchStats
): LlmBatchInfo | undefined => {
  if (stats.totalBatches === 0) {
    return undefined;
  }

  return {
    stage,
    batchSize: stats.batchSize,
    totalBatches: stats.totalBatches,
    completedBatches: stats.completedBatches,
    failedBatches: stats.failedBatches,
    lastBatchSize: stats.lastBatchSize,
  };
};

export async function applyLlmSuggestions(
  flows: ParsedFlow[],
  options: ApplyLlmSuggestionsOptions
): Promise<{
  applied: boolean;
  total: number;
  succeeded: number;
  batchInfo?: LlmBatchInfo;
}> {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  if (!baseUrl || !model || flows.length === 0) {
    return { applied: false, total: 0, succeeded: 0 };
  }

  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const books = await fetchBookSummaries(options.userId, options.candidateBookIds);

  console.log(`\n========== [LLM 智能分类开始] ==========`);
  console.log(`[配置] 模型: ${model}, 批次大小: ${batchSize}, 流水总数: ${flows.length}`);
  console.log(`[账本信息] 共有 ${books.length} 个可选账本:`);
  books.forEach((book, idx) => {
    console.log(`  ${idx + 1}. ${book.bookName} (ID: ${book.bookId})${book.description ? ` - ${book.description}` : ""}`);
  });
  console.log(``);

  // 第一步：批量判断每条流水所属的账本
  console.log(`========== [Step 1: 判断账本归属] ==========`);
  const {
    suggestions: bookSuggestions,
    stats: bookBatchStats,
  } = await suggestBookForFlows(flows, books, {
    baseUrl,
    apiKey,
    model,
    batchSize,
    onBatchProgress: options.onBatchProgress
      ? (stats) => options.onBatchProgress?.({ stage: "book", stats })
      : undefined,
  });
  
  // 统计第一步结果
  const bookSuccessCount = bookSuggestions.filter((r) => r !== null && r.bookId).length;
  const bookUndeterminedCount = bookSuggestions.filter((r) => r !== null && !r.bookId).length;
  console.log(`[Step 1 完成] 成功确定账本: ${bookSuccessCount} 条, 未确定: ${bookUndeterminedCount} 条, 失败: ${bookSuggestions.filter((r) => r === null).length} 条\n`);

  // 第二步：根据确定的账本，为每条流水匹配分类
  console.log(`========== [Step 2: 匹配分类] ==========`);
  const {
    suggestions: categorySuggestions,
    stats: categoryBatchStats,
  } = await suggestCategoryForFlows(flows, books, bookSuggestions, {
    baseUrl,
    apiKey,
    model,
    batchSize,
    onBatchProgress: options.onBatchProgress
      ? (stats) => options.onBatchProgress?.({ stage: "category", stats })
      : undefined,
  });
  
  // 统计第二步结果
  const categorySuccessCount = categorySuggestions.filter((r) => r !== null).length;
  console.log(`[Step 2 完成] 成功匹配分类: ${categorySuccessCount} 条, 失败: ${categorySuggestions.filter((r) => r === null).length} 条\n`);

  // 合并建议结果
  console.log(`========== [合并结果] ==========`);
  let succeeded = 0;
  const mergeStats = {
    hasBook: 0,
    hasCategory: 0,
    hasBoth: 0,
    hasNone: 0,
  };
  
  for (let i = 0; i < flows.length; i++) {
    const flow = flows[i];
    const bookSuggestion = bookSuggestions[i];
    const categorySuggestion = categorySuggestions[i];

    if (flow && (bookSuggestion || categorySuggestion)) {
      flow._meta = flow._meta || {};
      flow._meta.llmSuggestion = {
        index: i,
        ...(bookSuggestion || {}),
        ...(categorySuggestion || {}),
      };
      
      // 设置账本名称
      if (bookSuggestion?.bookId) {
        flow._meta.llmSuggestion.bookName =
          books.find((book) => book.bookId === bookSuggestion.bookId)?.bookName || bookSuggestion.bookId;
      }
      
      // 更新简化后的备注到流水本身
      if (categorySuggestion?.description) {
        flow.description = categorySuggestion.description;
      }
      
      // 统计
      const hasBook = !!bookSuggestion?.bookId;
      const hasCategory = !!categorySuggestion;
      if (hasBook && hasCategory) mergeStats.hasBoth++;
      else if (hasBook) mergeStats.hasBook++;
      else if (hasCategory) mergeStats.hasCategory++;
      else mergeStats.hasNone++;
      
      succeeded += 1;
    } else {
      mergeStats.hasNone++;
    }
  }

  console.log(`[合并统计]`);
  console.log(`  总数: ${flows.length}`);
  console.log(`  同时有账本和分类: ${mergeStats.hasBoth}`);
  console.log(`  仅有账本: ${mergeStats.hasBook}`);
  console.log(`  仅有分类: ${mergeStats.hasCategory}`);
  console.log(`  无建议: ${mergeStats.hasNone}`);
  console.log(`\n========== [LLM 智能分类完成] ==========\n`);

  const batchInfo =
    buildLlmBatchInfo("category", categoryBatchStats) ||
    buildLlmBatchInfo("book", bookBatchStats);

  return { applied: succeeded > 0, total: flows.length, succeeded, batchInfo };
}

/**
 * 导出：仅获取账本建议（独立调用）
 */
export async function suggestBookForFlowsOnly(
  flows: ParsedFlow[],
  options: ApplyLlmSuggestionsOptions
): Promise<{
  applied: boolean;
  total: number;
  succeeded: number;
  batchInfo?: LlmBatchInfo;
}> {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  if (!baseUrl || !model || flows.length === 0) {
    return { applied: false, total: 0, succeeded: 0 };
  }

  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const books = await fetchBookSummaries(options.userId, options.candidateBookIds);

  console.log(`\n========== [LLM 账本建议] ==========`);
  console.log(`[配置] 模型: ${model}, 批次大小: ${batchSize}, 流水总数: ${flows.length}`);
  console.log(`[账本信息] 共有 ${books.length} 个可选账本:`);
  books.forEach((book, idx) => {
    console.log(`  ${idx + 1}. ${book.bookName} (ID: ${book.bookId})${book.description ? ` - ${book.description}` : ""}`);
  });
  console.log(``);

  const {
    suggestions: bookSuggestions,
    stats: bookBatchStats,
  } = await suggestBookForFlows(flows, books, {
    baseUrl,
    apiKey,
    model,
    batchSize,
    onBatchProgress: options.onBatchProgress
      ? (stats) => options.onBatchProgress?.({ stage: "book", stats })
      : undefined,
  });

  // 统计结果
  const bookSuccessCount = bookSuggestions.filter((r) => r !== null && r.bookId).length;
  const bookUndeterminedCount = bookSuggestions.filter((r) => r !== null && !r.bookId).length;
  const failedCount = bookSuggestions.filter((r) => r === null).length;

  console.log(`[完成] 成功确定账本: ${bookSuccessCount} 条, 未确定: ${bookUndeterminedCount} 条, 失败: ${failedCount} 条`);
  console.log(`\n========== [LLM 账本建议完成] ==========\n`);

  // 将建议应用到流水中
  let succeeded = 0;
  for (let i = 0; i < flows.length; i++) {
    const flow = flows[i];
    const bookSuggestion = bookSuggestions[i];

    if (flow && bookSuggestion) {
      flow._meta = flow._meta || {};
      if (!flow._meta.llmSuggestion) {
        flow._meta.llmSuggestion = {};
      }
      
      // 更新账本建议
      flow._meta.llmSuggestion.bookId = bookSuggestion.bookId;
      if (typeof bookSuggestion.confidence === "number") {
        flow._meta.llmSuggestion.confidence = bookSuggestion.confidence;
      }
      
      // 设置账本名称
      if (bookSuggestion.bookId) {
        flow._meta.llmSuggestion.bookName =
          books.find((book) => book.bookId === bookSuggestion.bookId)?.bookName || bookSuggestion.bookId;
      }
      
      succeeded += 1;
    }
  }

  return {
    applied: succeeded > 0,
    total: flows.length,
    succeeded,
    batchInfo: buildLlmBatchInfo("book", bookBatchStats),
  };
}

/**
 * 导出：仅获取分类建议（独立调用）
 */
export async function suggestCategoryForFlowsOnly(
  flows: ParsedFlow[],
  options: ApplyLlmSuggestionsOptions
): Promise<{
  applied: boolean;
  total: number;
  succeeded: number;
  batchInfo?: LlmBatchInfo;
}> {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  if (!baseUrl || !model || flows.length === 0) {
    return { applied: false, total: 0, succeeded: 0 };
  }

  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const books = await fetchBookSummaries(options.userId, options.candidateBookIds);

  console.log(`\n========== [LLM 分类建议] ==========`);
  console.log(`[配置] 模型: ${model}, 批次大小: ${batchSize}, 流水总数: ${flows.length}`);

  // 从流水中提取已有的账本建议（可选，如果没有也不影响分类）
  const bookSuggestions: (BookSuggestion | null)[] = flows.map((flow, index) => {
    const llmSuggestion = flow._meta?.llmSuggestion;
    if (llmSuggestion?.bookId) {
      return {
        index,
        bookId: llmSuggestion.bookId,
        confidence: llmSuggestion.confidence,
      };
    }
    // 如果没有账本建议，尝试从流水本身的账本信息获取
    const appliedBookId = flow._meta?.appliedBookId;
    if (appliedBookId) {
      return {
        index,
        bookId: appliedBookId,
      };
    }
    return null;
  });

  const bookSuccessCount = bookSuggestions.filter((r) => r !== null && r.bookId).length;
  console.log(`[账本信息] 共有 ${books.length} 个可选账本，${bookSuccessCount} 条流水已确定账本`);
  if (bookSuccessCount === 0 && books.length > 0) {
    console.log(`[提示] 没有已确定账本的流水，将使用所有账本的分类信息进行匹配`);
  }

  const {
    suggestions: categorySuggestions,
    stats: categoryBatchStats,
  } = await suggestCategoryForFlows(flows, books, bookSuggestions, {
    baseUrl,
    apiKey,
    model,
    batchSize,
    onBatchProgress: options.onBatchProgress
      ? (stats) => options.onBatchProgress?.({ stage: "category", stats })
      : undefined,
  });

  // 统计结果
  const categorySuccessCount = categorySuggestions.filter((r) => r !== null).length;
  const failedCount = categorySuggestions.filter((r) => r === null).length;

  console.log(`[完成] 成功匹配分类: ${categorySuccessCount} 条, 失败: ${failedCount} 条`);
  console.log(`\n========== [LLM 分类建议完成] ==========\n`);

  // 将建议应用到流水中
  let succeeded = 0;
  for (let i = 0; i < flows.length; i++) {
    const flow = flows[i];
    const categorySuggestion = categorySuggestions[i];

    if (flow && categorySuggestion) {
      flow._meta = flow._meta || {};
      if (!flow._meta.llmSuggestion) {
        flow._meta.llmSuggestion = {};
      }
      
      const suggestion = flow._meta.llmSuggestion;
      
      // 更新分类建议（保留已有的账本建议）
      if (categorySuggestion.flowType) {
        suggestion.flowType = categorySuggestion.flowType;
      }
      if (categorySuggestion.industryType) {
        suggestion.industryType = categorySuggestion.industryType;
      }
      if (categorySuggestion.primaryCategory) {
        suggestion.primaryCategory = categorySuggestion.primaryCategory;
      }
      if (categorySuggestion.secondaryCategory) {
        suggestion.secondaryCategory = categorySuggestion.secondaryCategory;
      }
      if (categorySuggestion.attribution) {
        suggestion.attribution = categorySuggestion.attribution;
      }
      if (categorySuggestion.description) {
        suggestion.description = categorySuggestion.description;
        // 更新简化后的备注到流水本身
        flow.description = categorySuggestion.description;
      }
      if (typeof categorySuggestion.confidence === "number") {
        suggestion.confidence = categorySuggestion.confidence;
      }
      if (categorySuggestion.comment) {
        suggestion.comment = categorySuggestion.comment;
      }
      
      succeeded += 1;
    }
  }

  return {
    applied: succeeded > 0,
    total: flows.length,
    succeeded,
    batchInfo: buildLlmBatchInfo("category", categoryBatchStats),
  };
}

/**
 * 第一步：批量判断每条流水所属的账本（内部函数）
 */
async function suggestBookForFlows(
  flows: ParsedFlow[],
  books: BookSummary[],
  options: {
    baseUrl: string;
    apiKey: string | undefined;
    model: string;
    batchSize: number;
    onBatchProgress?: (stats: BatchStats) => void;
  }
): Promise<{ suggestions: (BookSuggestion | null)[]; stats: BatchStats }> {
  const results: (BookSuggestion | null)[] = new Array(flows.length).fill(null);
  const batchSize = options.batchSize;
  const stats: BatchStats = emptyBatchStats(batchSize);
  stats.totalBatches = flows.length === 0 ? 0 : Math.ceil(flows.length / batchSize);

  // 构建账本信息 prompt（只包含账本名称和描述）
  const bookPrompt = books
    .map((book) => {
      const desc = book.description ? `\n  描述: ${book.description}` : "";
      return `- ${book.bookName} (ID: ${book.bookId})${desc}`;
    })
    .join("\n\n");

  console.log(`[账本信息 Prompt]\n${bookPrompt}\n`);

  const totalBatches = stats.totalBatches;
  let failedBatches = 0;
  for (let i = 0; i < flows.length; i += batchSize) {
    const chunk = flows.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const prompt = buildBookSelectionPrompt(chunk, bookPrompt);
    stats.lastBatchSize = chunk.length;
    
    console.log(`--- [批次 ${batchNum}/${totalBatches}] 处理 ${chunk.length} 条流水 ---`);
    console.log(`[输入流水] (仅发送: 交易对象、当前分类、备注)`);
    chunk.forEach((flow, idx) => {
      console.log(`  Flow #${idx}: 交易对象=${flow.name || ""}, 分类=${flow.industryType || ""}, 备注=${flow.description || ""}`);
    });
    console.log(`\n[发送给模型的 Prompt]\n${prompt.substring(0, 10000)}${prompt.length > 10000 ? "... (截断)" : ""}\n`);
    
    try {
      const suggestions = await callLlmForBookSelection(
        options.baseUrl,
        options.apiKey,
        options.model,
        prompt
      );
      
      console.log(`[模型返回结果]`);
      suggestions.forEach((suggestion) => {
        const originalIndex = i + suggestion.index;
        if (originalIndex < flows.length) {
          results[originalIndex] = suggestion;
          const bookName = books.find((b) => b.bookId === suggestion.bookId)?.bookName || suggestion.bookId || "未确定";
          console.log(`  Flow #${suggestion.index} (原始索引: ${originalIndex}): 账本=${bookName}, 置信度=${suggestion.confidence?.toFixed(2) || "N/A"}`);
        }
      });
      console.log(``);
      stats.completedBatches += 1;
      options.onBatchProgress?.({ ...stats });
    } catch (err: any) {
      failedBatches += 1;
      const errorMessage = err?.message || String(err);
      console.error(
        `[错误] 批次 ${batchNum} 调用LLM失败:`,
        errorMessage
      );
      console.log(``);
      stats.failedBatches = failedBatches;
      options.onBatchProgress?.({ ...stats });
      // 继续处理下一批次
      continue;
    }
  }

  if (failedBatches > 0) {
    console.warn(`[suggestBookForFlows] 完成处理，成功 ${results.filter((r) => r !== null).length} 条，失败 ${failedBatches} 个批次`);
    stats.failedBatches = failedBatches;
    options.onBatchProgress?.({ ...stats });
  }

  return { suggestions: results, stats };
}

/**
 * 模糊匹配分类：检查当前分类是否能匹配到账本已有的分类
 */
function fuzzyMatchCategory(
  flow: ParsedFlow,
  book: BookSummary
): CategorySuggestion | null {
  const currentCategory = flow.industryType?.trim() || "";
  if (!currentCategory) {
    return null;
  }

  // 1. 完全匹配
  const allCategories = [
    ...book.primaryCategories,
    ...book.secondaryCategories,
  ];
  
  // 完全匹配（忽略大小写和空格）
  const normalizedCurrent = currentCategory.toLowerCase().replace(/\s+/g, "");
  for (const category of allCategories) {
    const normalizedCategory = category.toLowerCase().replace(/\s+/g, "");
    if (normalizedCurrent === normalizedCategory) {
      // 完全匹配成功
      const isSecondary = category.includes("/");
      const parts = isSecondary ? category.split("/") : [category];
      
      return {
        index: 0, // 会在调用处设置正确的index
        flowType: flow.flowType || book.flowTypes[0] || undefined,
        industryType: category,
        primaryCategory: parts[0],
        secondaryCategory: isSecondary ? parts[1] : undefined,
        description: flow.description || undefined,
        confidence: 0.95, // 完全匹配，高置信度
      };
    }
  }

  // 2. 部分匹配（包含关系）
  for (const category of allCategories) {
    const normalizedCategory = category.toLowerCase().replace(/\s+/g, "");
    // 当前分类包含账本分类，或账本分类包含当前分类
    if (
      normalizedCurrent.includes(normalizedCategory) ||
      normalizedCategory.includes(normalizedCurrent)
    ) {
      const isSecondary = category.includes("/");
      const parts = isSecondary ? category.split("/") : [category];
      
      return {
        index: 0,
        flowType: flow.flowType || book.flowTypes[0] || undefined,
        industryType: category,
        primaryCategory: parts[0],
        secondaryCategory: isSecondary ? parts[1] : undefined,
        description: flow.description || undefined,
        confidence: 0.85, // 部分匹配，较高置信度
      };
    }
  }

  // 3. 二级分类匹配：如果当前分类是"一级/二级"格式，尝试匹配一级分类
  if (currentCategory.includes("/")) {
    const parts = currentCategory.split("/");
    const primaryPart = parts[0].trim().toLowerCase().replace(/\s+/g, "");
    
    for (const category of book.primaryCategories) {
      const normalizedCategory = category.toLowerCase().replace(/\s+/g, "");
      if (normalizedCategory === primaryPart) {
        // 一级分类匹配成功，使用当前分类作为二级分类
        return {
          index: 0,
          flowType: flow.flowType || book.flowTypes[0] || undefined,
          industryType: currentCategory,
          primaryCategory: category,
          secondaryCategory: parts[1]?.trim(),
          description: flow.description || undefined,
          confidence: 0.80, // 一级分类匹配，中等置信度
        };
      }
    }
  }

  return null; // 没有匹配到
}

/**
 * 第二步：根据已确定的账本，为每条流水匹配分类
 */
async function suggestCategoryForFlows(
  flows: ParsedFlow[],
  books: BookSummary[],
  bookSuggestions: (BookSuggestion | null)[],
  options: {
    baseUrl: string;
    apiKey: string | undefined;
    model: string;
    batchSize: number;
    onBatchProgress?: (stats: BatchStats) => void;
  }
): Promise<{ suggestions: (CategorySuggestion | null)[]; stats: BatchStats }> {
  const results: (CategorySuggestion | null)[] = new Array(flows.length).fill(null);
  const batchSize = options.batchSize;
  const stats: BatchStats = emptyBatchStats(batchSize);
  stats.totalBatches = flows.length === 0 ? 0 : Math.ceil(flows.length / batchSize);
  
  // 统计模糊匹配结果
  let fuzzyMatchedCount = 0;
  let aiProcessedCount = 0;

  let failedBatches = 0;
  for (let i = 0; i < flows.length; i += batchSize) {
    const chunk = flows.slice(i, i + batchSize);
    const chunkBookSuggestions = bookSuggestions.slice(i, i + batchSize);
    stats.lastBatchSize = chunk.length;
    let chunkFailed = false;

    // 为这一批次中的每条流水构建分类 prompt（根据其确定的账本）
    const flowsWithBooks = chunk.map((flow, chunkIndex) => {
      const originalIndex = i + chunkIndex;
      const bookSuggestion = chunkBookSuggestions[chunkIndex];
      const bookId = bookSuggestion?.bookId;
      const book = bookId ? books.find((b) => b.bookId === bookId) : null;

      return {
        flow,
        bookIndex: originalIndex,
        chunkIndex,
        book,
      };
    });

    // 按账本分组，相同账本的流水一起处理
    const flowsByBook = new Map<string | null, typeof flowsWithBooks>();
    flowsWithBooks.forEach((item) => {
      const bookId = item.book?.bookId || null;
      if (!flowsByBook.has(bookId)) {
        flowsByBook.set(bookId, []);
      }
      flowsByBook.get(bookId)!.push(item);
    });

    // 为每个账本组构建并调用 prompt
    const batchNum = Math.floor(i / batchSize) + 1;
    console.log(`--- [批次 ${batchNum}/${Math.ceil(flows.length / batchSize)}] 按账本分组 ---`);
    for (const [bookId, bookFlows] of flowsByBook.entries()) {
      if (bookFlows.length === 0) continue;

      const book: BookSummary | null = bookId ? (books.find((b) => b.bookId === bookId) || null) : null;
      if (!book && bookId) {
        // 账本不存在，但继续处理（使用 null book，会使用所有账本的分类信息）
        console.warn(`  [警告] 账本 ${bookId} 不存在，将使用所有账本的分类信息处理 ${bookFlows.length} 条流水`);
      }

      const bookName = book?.bookName || "未确定账本";
      console.log(`  [账本组] ${bookName} (${bookFlows.length} 条流水)`);
      
      if (book) {
        console.log(`  [账本分类信息]`);
        console.log(`    类型: ${book.flowTypes.join("、") || "无"}`);
        console.log(`    一级分类: ${book.primaryCategories.join("、") || "无"}`);
        console.log(`    二级分类: ${book.secondaryCategories.join("、") || "无"}`);
      }
      
      // 先进行模糊匹配（只有在有账本信息时才进行模糊匹配）
      const flowsToProcess: typeof bookFlows = [];
      const fuzzyMatched: Array<{ item: typeof bookFlows[0]; suggestion: CategorySuggestion }> = [];
      
      if (book) {
        console.log(`  [模糊匹配阶段]`);
        for (const item of bookFlows) {
          const matched = fuzzyMatchCategory(item.flow, book);
          if (matched) {
            matched.index = item.chunkIndex;
            fuzzyMatched.push({ item, suggestion: matched });
            const originalIndex = item.bookIndex;
            if (originalIndex < flows.length) {
              results[originalIndex] = matched;
              fuzzyMatchedCount++;
              console.log(`    Flow #${item.chunkIndex} (原始索引: ${originalIndex}): 模糊匹配成功`);
              console.log(`      当前分类: ${item.flow.industryType || ""}`);
              console.log(`      匹配分类: ${matched.industryType || matched.primaryCategory || "未确定"}`);
              console.log(`      置信度: ${matched.confidence?.toFixed(2) || "N/A"}`);
            }
          } else {
            flowsToProcess.push(item);
          }
        }
      } else {
        // 没有账本信息，所有流水都需要AI处理
        console.log(`  [模糊匹配阶段] 跳过（无账本信息）`);
        flowsToProcess.push(...bookFlows);
      }
      
      console.log(`  [模糊匹配结果] 匹配成功: ${fuzzyMatched.length} 条, 需要AI处理: ${flowsToProcess.length} 条\n`);
      
      // 对模糊匹配成功的流水，调用AI简化备注
      if (fuzzyMatched.length > 0) {
        console.log(`  [AI简化备注阶段] 处理 ${fuzzyMatched.length} 条流水的备注`);
      try {
          const descriptionSuggestions = await callLlmForDescriptionSimplification(
            options.baseUrl,
            options.apiKey,
            options.model,
            fuzzyMatched.map((matched) => matched.item.flow)
          );
          
          // 更新模糊匹配结果的备注
          descriptionSuggestions.forEach((descSuggestion) => {
            const idx = descSuggestion.index;
            if (idx >= 0 && idx < fuzzyMatched.length && descSuggestion.description) {
              const matchedItem = fuzzyMatched[idx];
              if (matchedItem && matchedItem.suggestion) {
                matchedItem.suggestion.description = descSuggestion.description;
                // 更新到results中
                const originalIndex = matchedItem.item.bookIndex;
                if (originalIndex < flows.length && results[originalIndex]) {
                  results[originalIndex]!.description = descSuggestion.description;
                }
                console.log(`    Flow #${matchedItem.item.chunkIndex} (原始索引: ${originalIndex}): 简化备注成功`);
              }
            }
          });
          console.log(``);
        } catch (err: any) {
          const errorMessage = err?.message || String(err);
          console.warn(`  [警告] 简化备注失败: ${errorMessage}，将使用原始备注`);
          console.log(``);
        }
      }
      
      // 如果没有需要AI处理的流水，跳过AI调用
      if (flowsToProcess.length === 0) {
        console.log(``);
        continue;
      }
      
      // 对未匹配的流水调用AI
      const prompt = buildCategorySelectionPrompt(
        flowsToProcess.map((item) => item.flow),
        book || null
      );
      
      console.log(`  [AI处理阶段] 处理 ${flowsToProcess.length} 条流水`);
      console.log(`  [输入流水] (仅发送: 当前分类、交易对象、备注、流水归属)`);
      flowsToProcess.forEach((item, idx) => {
        console.log(`    Flow #${idx} (原始索引: ${item.bookIndex}): 当前分类=${item.flow.industryType || ""}, 交易对象=${item.flow.name || ""}, 备注=${item.flow.description || ""}, 流水归属=${bookName}`);
      });
      
      console.log(`  \n  [发送给模型的 Prompt]\n  ${prompt.substring(0, 10000)}${prompt.length > 10000 ? "... (截断)" : ""}\n`);

      try {
        const suggestions = await callLlmForCategorySelection(
          options.baseUrl,
          options.apiKey,
          options.model,
          prompt
        );

        console.log(`  [模型返回结果]`);
        suggestions.forEach((suggestion) => {
          const bookFlowItem = flowsToProcess[suggestion.index];
          if (bookFlowItem) {
            const originalIndex = bookFlowItem.bookIndex;
            if (originalIndex < flows.length) {
              results[originalIndex] = suggestion;
              aiProcessedCount++;
              console.log(`    Flow #${suggestion.index} (原始索引: ${originalIndex}):`);
              console.log(`      类型: ${suggestion.flowType || "未确定"}`);
              console.log(`      分类: ${suggestion.industryType || suggestion.primaryCategory || "未确定"}`);
              if (suggestion.secondaryCategory) {
                console.log(`      二级分类: ${suggestion.secondaryCategory}`);
              }
              if (suggestion.description) {
                console.log(`      简化备注: ${suggestion.description}`);
              }
              console.log(`      置信度: ${suggestion.confidence?.toFixed(2) || "N/A"}`);
              if (suggestion.comment) {
                console.log(`      理由: ${suggestion.comment}`);
              }
            }
          }
        });
        console.log(``);
      } catch (err: any) {
        failedBatches += 1;
        chunkFailed = true;
        const errorMessage = err?.message || String(err);
        console.error(
          `  [错误] 账本 ${bookName} 调用LLM失败:`,
          errorMessage
        );
        console.log(``);
        // 继续处理下一组
        continue;
      }
    }
    if (!chunkFailed) {
      stats.completedBatches += 1;
    }
    stats.failedBatches = failedBatches;
    options.onBatchProgress?.({ ...stats });
  }

  stats.failedBatches = failedBatches;
  options.onBatchProgress?.({ ...stats });

  const totalSuccess = results.filter((r) => r !== null).length;
  console.log(`[suggestCategoryForFlows] 完成处理:`);
  console.log(`  模糊匹配成功: ${fuzzyMatchedCount} 条`);
  console.log(`  AI处理成功: ${aiProcessedCount} 条`);
  console.log(`  总计成功: ${totalSuccess} 条`);
  if (failedBatches > 0) {
    console.warn(`  失败批次: ${failedBatches} 个`);
  }

  return { suggestions: results, stats };
}

async function fetchBookSummaries(userId: number, candidateBookIds?: string[]): Promise<BookSummary[]> {
  const where: any = { userId };
  if (candidateBookIds && candidateBookIds.length > 0) {
    where.bookId = { in: candidateBookIds };
  }

  const books = (await prisma.book.findMany({
    where,
    select: {
      bookId: true,
      bookName: true,
      description: true,
    },
  })) as Array<{ bookId: string; bookName: string; description: string | null }>;

  const summaries: BookSummary[] = [];
  for (const book of books) {
    const flowTypes = await prisma.flow.findMany({
      where: {
        userId,
        bookId: book.bookId,
        flowType: { not: null },
      },
      select: { flowType: true },
      distinct: ["flowType"],
    });

    const industryTypes = await prisma.flow.findMany({
      where: {
        userId,
        bookId: book.bookId,
        industryType: { not: null },
      },
      select: { industryType: true },
      distinct: ["industryType"],
    });

    const relationCategories = await prisma.typeRelation.findMany({
      where: { bookId: book.bookId },
      select: { target: true },
      distinct: ["target"],
    });

    const primaryCategories: string[] = [];
    const secondaryCategories: string[] = [];

    Array.from(
      new Set([
        ...industryTypes.map((item) => item.industryType!).filter(Boolean),
        ...relationCategories.map((item) => item.target).filter(Boolean),
      ])
    ).forEach((category) => {
      if (category.includes("/")) {
        secondaryCategories.push(category);
      } else {
        primaryCategories.push(category);
      }
    });

    summaries.push({
      bookId: book.bookId,
      bookName: book.bookName,
      description: book.description,
      flowTypes: flowTypes.map((item) => item.flowType!).filter(Boolean),
      primaryCategories,
      secondaryCategories,
    });
  }

  return summaries;
}

/**
 * 构建账本选择 prompt（第一步：只判断账本归属）
 */
function buildBookSelectionPrompt(flows: ParsedFlow[], bookPrompt: string): string {
  // 只发送交易对方、当前分类、备注，减少token数量
  const flowLines = flows
    .map(
      (flow, index) =>
        `Flow #${index}:\n交易对象: ${flow.name || ""}\n当前分类: ${flow.industryType || ""}\n备注: ${flow.description || ""}`
    )
    .join("\n\n");

  return `你是一个财务流水账本归属判断助手。以下是可选账本信息：
${bookPrompt || "（暂无账本）"}

请根据流水的交易对象、分类和备注，判断每条流水应该归属于哪个账本。只返回结果，不要推理过程。

输出格式（严格 JSON 数组）：
[
  {"index": 0, "bookId": "账本ID", "confidence": 0.95},
  {"index": 1, "bookId": "", "confidence": 0.3}
]

要求：
1. bookId: 从上述账本列表中选择，无法判断则置空字符串
2. confidence: 0.0-1.0 的置信度
3. 只输出 JSON，不要任何解释文字

流水数据：
${flowLines}`;
}

/**
 * 构建分类选择 prompt（第二步：根据账本匹配分类）
 */
function buildCategorySelectionPrompt(flows: ParsedFlow[], book: BookSummary | null): string {
  const flowLines = flows
    .map(
      (flow, index) =>
        `Flow #${index}:\n当前分类: ${flow.industryType || ""}\n交易对象: ${flow.name || ""}\n备注: ${flow.description || ""}\n流水归属: ${book?.bookName || "未确定账本"}`
    )
    .join("\n\n");

  if (!book) {
    // 如果没有确定的账本，提供所有账本信息供参考
    return `为下列流水匹配分类并简化备注。只返回JSON结果，不要任何解释文字。

${flowLines}

输出格式（严格 JSON 数组）：
[
  {
    "index": 0,
    "flowType": "支出/收入/转账",
    "primaryCategory": "一级分类名称（如：餐饮、交通、购物等）",
    "secondaryCategory": "二级分类名称（可选，如：午餐、地铁等）",
    "industryType": "若包含二级分类，请输出 一级分类名/二级分类名（如：餐饮/午餐）；否则只输出一级分类名（如：餐饮）",
    "description": "简化后的备注（必须提供）",
    "confidence": 0.0-1.0
  }
]

要求：
1. 根据当前分类、交易对象、备注匹配合适的分类。
2. industryType 必须输出具体的分类名称，不能输出"一级"这样的占位符。如果只有一级分类，输出一级分类名称；如果有二级分类，输出"一级分类名/二级分类名"。
3. description 必须提供简化后的备注。
4. 只输出 JSON，不要任何解释文字。`;
  }

  const primary = book.primaryCategories.length ? book.primaryCategories.join("、") : "无";
  const secondary = book.secondaryCategories.length ? book.secondaryCategories.join("、") : "无";
  const flowTypes = book.flowTypes.length ? book.flowTypes.join("、") : "无";

  // 构建分类示例，帮助AI理解格式
  const categoryExamples: string[] = [];
  if (book.primaryCategories.length > 0) {
    categoryExamples.push(`一级分类示例: ${book.primaryCategories.slice(0, 3).join("、")}`);
  }
  if (book.secondaryCategories.length > 0) {
    const example = book.secondaryCategories[0];
    const parts = example.split("/");
    if (parts.length === 2) {
      categoryExamples.push(`二级分类格式示例: ${example} (格式: 一级/二级)`);
    }
  }

  return `为下列流水匹配分类并简化备注。只返回JSON结果，不要任何解释文字。

账本"${book.bookName}"的分类信息：
类型: ${flowTypes}
一级分类: ${primary}
二级分类: ${secondary}
${categoryExamples.length > 0 ? categoryExamples.join("\n") : ""}

流水数据：
${flowLines}

输出格式（严格 JSON 数组）：
[
  {
    "index": 0,
    "flowType": "支出/收入/转账（必须从上述类型中选择）",
    "primaryCategory": "一级分类名称（如：餐饮、交通、购物等）",
    "secondaryCategory": "二级分类名称（可选，如：午餐、地铁等）",
    "industryType": "若包含二级分类，请输出 一级分类名/二级分类名（如：餐饮/午餐）；否则只输出一级分类名（如：餐饮）",
    "description": "简化后的备注（必须提供）",
    "confidence": 0.0-1.0
  }
]

要求：
1. 优先从账本已有分类中选择最贴近的分类。
2. 如果没有更接近的分类，根据当前分类格式创建新分类（遵循一级分类或一级/二级格式）。
3. industryType 必须输出具体的分类名称，不能输出"一级"这样的占位符。如果只有一级分类，输出一级分类名称；如果有二级分类，输出"一级分类名/二级分类名"。
4. description 必须提供简化后的备注（去除冗余信息，保留关键内容）。
5. flowType 必须从账本的类型中选择。
6. 只输出 JSON，不要任何解释文字。`;
}

/**
 * 调用 LLM 获取账本选择建议（第一步）
 */
async function callLlmForBookSelection(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  prompt: string
): Promise<BookSuggestion[]> {
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS) || 300000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: "你是财务流水账本归属判断助手。只返回JSON结果，不要任何解释文字。" },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`LLM 接口返回错误: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error("LLM 返回空内容");
    }

    console.log("[LLM Book Selection 原始响应]");
    console.log(raw);
    console.log(``);

    const cleaned = raw.startsWith("```") ? raw.replace(/```json?|```/g, "").trim() : raw;
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      console.error("[解析错误] LLM 返回内容不是数组，原始内容:", parsed);
      throw new Error("LLM 返回内容不是数组");
    }

    console.log(`[解析成功] 共 ${parsed.length} 条建议\n`);

    return parsed.map((item: any) => ({
      index: item.index ?? 0,
      bookId: item.bookId || undefined,
      confidence: typeof item.confidence === "number" ? item.confidence : undefined,
      // 不再返回 comment，减少处理时间
    }));
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === "AbortError" || error.message?.includes("timeout") || error.message?.includes("Timeout")) {
      throw new Error(`LLM 请求超时（${timeoutMs / 1000}秒），请检查网络连接或稍后重试`);
    }
    
    if (error.message?.includes("fetch failed") || error.cause?.name === "HeadersTimeoutError") {
      throw new Error(`LLM 服务连接失败，请检查网络连接或 LLM 服务是否可用`);
    }
    
    throw error;
  }
}

/**
 * 构建简化备注的 prompt
 */
function buildDescriptionSimplificationPrompt(flows: ParsedFlow[]): string {
  const flowLines = flows
    .map(
      (flow, index) =>
        `Flow #${index}:\n备注: ${flow.description || ""}`
    )
    .join("\n\n");

  return `简化下列流水的备注，去除冗余信息，保留关键内容。只返回JSON结果，不要任何解释文字。

${flowLines}

输出格式（严格 JSON 数组）：
[
  {"index": 0, "description": "简化后的备注"},
  {"index": 1, "description": "简化后的备注"}
]

要求：
1. 去除冗余信息（如：商户号、订单号、时间戳等）。
2. 保留关键内容（如：商户名称、商品名称、交易类型等）。
3. 如果原备注为空或无效，返回空字符串。
4. 只输出 JSON，不要任何解释文字。`;
}

/**
 * 调用 LLM 简化备注
 */
async function callLlmForDescriptionSimplification(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  flows: ParsedFlow[]
): Promise<Array<{ index: number; description: string }>> {
  if (flows.length === 0) {
    return [];
  }

  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS) || 300000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const prompt = buildDescriptionSimplificationPrompt(flows);
    
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: "你是备注简化助手。只返回JSON结果，不要任何解释文字，不要思考过程，直接给出答案。" },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`LLM 接口返回错误: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error("LLM 返回空内容");
    }

    console.log(`  [LLM Description Simplification 原始响应]`);
    console.log(`  ${raw}`);
    console.log(``);

    const cleaned = raw.startsWith("```") ? raw.replace(/```json?|```/g, "").trim() : raw;
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      console.error(`  [解析错误] LLM 返回内容不是数组，原始内容:`, parsed);
      throw new Error("LLM 返回内容不是数组");
    }

    console.log(`  [解析成功] 共 ${parsed.length} 条简化备注\n`);

    return parsed.map((item: any) => ({
      index: item.index ?? 0,
      description: item.description || "",
    }));
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === "AbortError" || error.message?.includes("timeout") || error.message?.includes("Timeout")) {
      throw new Error(`LLM 请求超时（${timeoutMs / 1000}秒），请检查网络连接或稍后重试`);
    }
    
    if (error.message?.includes("fetch failed") || error.cause?.name === "HeadersTimeoutError") {
      throw new Error(`LLM 服务连接失败，请检查网络连接或 LLM 服务是否可用`);
    }
    
    throw error;
  }
}

/**
 * 调用 LLM 获取分类建议（第二步）
 */
async function callLlmForCategorySelection(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  prompt: string
): Promise<CategorySuggestion[]> {
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS) || 300000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: "你是财务流水分类助手。只返回JSON结果，不要任何解释文字，不要思考过程，直接给出答案。" },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`LLM 接口返回错误: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error("LLM 返回空内容");
    }

    console.log(`  [LLM Category Selection 原始响应]`);
    console.log(`  ${raw}`);
    console.log(``);

    const cleaned = raw.startsWith("```") ? raw.replace(/```json?|```/g, "").trim() : raw;
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      console.error(`  [解析错误] LLM 返回内容不是数组，原始内容:`, parsed);
      throw new Error("LLM 返回内容不是数组");
    }

    console.log(`  [解析成功] 共 ${parsed.length} 条建议\n`);

    return parsed.map((item: any) => {
      // 修复：如果 industryType 是"一级"这样的占位符，使用 primaryCategory 的值
      let industryType = item.industryType || undefined;
      if (industryType === "一级" || industryType === "一级分类") {
        industryType = item.primaryCategory || undefined;
      }
      
      // 如果 industryType 仍然为空，但有 primaryCategory，则使用 primaryCategory
      if (!industryType && item.primaryCategory) {
        if (item.secondaryCategory) {
          industryType = `${item.primaryCategory}/${item.secondaryCategory}`;
        } else {
          industryType = item.primaryCategory;
        }
      }
      
      return {
        index: item.index ?? 0,
        flowType: item.flowType || undefined,
        industryType,
        primaryCategory: item.primaryCategory || undefined,
        secondaryCategory: item.secondaryCategory || undefined,
        attribution: item.attribution || undefined,
        description: item.description || undefined,
        confidence: typeof item.confidence === "number" ? item.confidence : undefined,
        comment: item.comment || undefined,
      };
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === "AbortError" || error.message?.includes("timeout") || error.message?.includes("Timeout")) {
      throw new Error(`LLM 请求超时（${timeoutMs / 1000}秒），请检查网络连接或稍后重试`);
    }
    
    if (error.message?.includes("fetch failed") || error.cause?.name === "HeadersTimeoutError") {
      throw new Error(`LLM 服务连接失败，请检查网络连接或 LLM 服务是否可用`);
    }
    
    throw error;
  }
}

/**
 * 保留旧的 buildPrompt 函数以保持兼容性（已废弃，但保留以防有地方直接调用）
 * @deprecated 使用 buildBookSelectionPrompt 和 buildCategorySelectionPrompt 替代
 */
function buildPrompt(flows: ParsedFlow[], bookPrompt: string): string {
  const flowLines = flows
    .map(
      (flow, index) =>
        `Flow #${index}:\n日期: ${flow.day}\n金额: ${flow.money}\n类型: ${flow.flowType}\n交易对象: ${flow.name || ""}\n支付方式: ${
          flow.payType || ""
        }\n原始分类: ${flow.industryType || ""}\n备注: ${flow.description || ""}`
    )
    .join("\n\n");

  return `你是一个财务流水分类助手。以下是账本信息：
${bookPrompt || "（暂无历史分类）"}

请读取下列流水，并为每条流水输出 JSON 数组，格式如下：
[
  {
    "index": 0,
    "bookId": "账本ID",
    "flowType": "支出/收入/转账",
    "primaryCategory": "一级分类，如 餐饮",
    "secondaryCategory": "二级分类，如 午餐（可选）",
    "industryType": "若包含二级分类，请输出 一级/二级；否则输出一级",
    "attribution": "可选归属",
    "description": "可选简化备注",
    "confidence": 0.0-1.0,
    "comment": "简短理由"
  }
]

要求：
1. 尽量复用已存在的账本和分类；如需新分类，请在 comment 中说明。
2. 如果无法判断，bookId 置空并解释原因。
3. 请严格输出 JSON。

${flowLines}`;
}


