import { getUserId, success, error } from "~/server/utils/common";
import { 
  applyLlmSuggestions,
  suggestBookForFlowsOnly,
  suggestCategoryForFlowsOnly,
  type LlmBatchInfo,
} from "~/server/utils/llmFlowClassifier";
import { RuleEngineService } from "~/server/utils/ruleEngineService";
import { RuleBootstrapService } from "~/server/utils/ruleBootstrapService";
import { AccountDetectorService } from "~/server/utils/accountDetectorService";
import { AccountProfileService } from "~/server/utils/accountProfileService";
import prisma from "~/lib/prisma";
import type { ParsedFlow } from "~/server/utils/flowParser";
import {
  setProgressPayload,
  clearProgressPayload,
} from "~/server/utils/progressStore";

type StageStatus = "pending" | "partial" | "completed" | "skipped";
type SmartImportMatchMode = "history-first" | "history-only" | "ai-only";

interface StageProgressPayload {
  key: string;
  label: string;
  scope: number;
  matched: number;
  status: StageStatus;
}

/**
 * 根据分类占比匹配账本（兜底，仅在 mode === "book" 时使用）
 */
async function matchBookByCategory(
  flow: ParsedFlow,
  userId: number,
  candidateBookIds?: string[]
): Promise<{ bookId: string; bookName: string; ratio: number } | null> {
  const category = flow.industryType?.trim();
  if (!category) {
    return null;
  }

  const where: any = { userId };
  if (candidateBookIds && candidateBookIds.length > 0) {
    where.bookId = { in: candidateBookIds };
  }

  const books = await prisma.book.findMany({
    where,
    select: {
      bookId: true,
      bookName: true,
    },
  });

  if (books.length === 0) {
    return null;
  }

  const candidates: Array<{ bookId: string; bookName: string; ratio: number }> = [];

  for (const book of books) {
    const profile = await AccountProfileService.getProfile(userId, book.bookId);
    if (!profile || !profile.categoryWeights || Object.keys(profile.categoryWeights).length === 0) {
      continue;
    }

    const categoryCount = profile.categoryWeights[category] || 0;
    if (categoryCount === 0) {
      continue;
    }

    const expenseFlows = await prisma.flow.findMany({
      where: {
        userId,
        bookId: book.bookId,
        flowType: "支出",
        eliminate: 0,
        industryType: { not: null },
      },
      select: {
        industryType: true,
      },
    });

    if (expenseFlows.length === 0) {
      const totalCategoryCount = Object.values(profile.categoryWeights).reduce((sum, count) => sum + count, 0);
      if (totalCategoryCount === 0) {
        continue;
      }
      const ratio = categoryCount / totalCategoryCount;
      candidates.push({
        bookId: book.bookId,
        bookName: book.bookName,
        ratio,
      });
      continue;
    }

    const expenseCategoryCount = expenseFlows.filter((f) => f.industryType === category).length;
    if (expenseCategoryCount === 0) {
      continue;
    }

    const ratio = expenseCategoryCount / expenseFlows.length;
    candidates.push({
      bookId: book.bookId,
      bookName: book.bookName,
      ratio,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.ratio - a.ratio);
  return candidates[0];
}

interface ProgressPayload {
  total: number;
  matched: number;
  stages: StageProgressPayload[];
  llmBatch?: LlmBatchInfo;
}

const deriveStageStatus = (scope: number, matched: number): StageStatus => {
  if (scope === 0) {
    return "skipped";
  }
  if (matched <= 0) {
    return "pending";
  }
  if (matched >= scope) {
    return "completed";
  }
  return "partial";
};

const buildProgressPayload = ({
  total,
  ruleMatchedCount,
  attributionMatchedCount,
  categoryMatchedCount,
  profileMatchedCount,
  llmScope,
  llmMatchedCount,
  llmBatch,
}: {
  total: number;
  ruleMatchedCount: number;
  attributionMatchedCount: number;
  categoryMatchedCount: number;
  profileMatchedCount: number;
  llmScope: number;
  llmMatchedCount: number;
  llmBatch?: LlmBatchInfo;
}): ProgressPayload => {
  const safeTotal = total || 0;
  const attributionScope = Math.max(safeTotal - ruleMatchedCount, 0);
  const categoryScope = Math.max(attributionScope - attributionMatchedCount, 0);
  const profileScope = Math.max(categoryScope - categoryMatchedCount, 0);
  const matched = Math.min(
    safeTotal,
    ruleMatchedCount + attributionMatchedCount + categoryMatchedCount + profileMatchedCount + llmMatchedCount
  );

  const stages: StageProgressPayload[] = [
    {
      key: "rules",
      label: "规则引擎",
      scope: safeTotal,
      matched: ruleMatchedCount,
      status: deriveStageStatus(safeTotal, ruleMatchedCount),
    },
    {
      key: "attribution",
      label: "归属匹配",
      scope: attributionScope,
      matched: attributionMatchedCount,
      status: deriveStageStatus(attributionScope, attributionMatchedCount),
    },
    {
      key: "category",
      label: "分类匹配",
      scope: categoryScope,
      matched: categoryMatchedCount,
      status: deriveStageStatus(categoryScope, categoryMatchedCount),
    },
    {
      key: "profiles",
      label: "账本画像",
      scope: profileScope,
      matched: profileMatchedCount,
      status: deriveStageStatus(profileScope, profileMatchedCount),
    },
    {
      key: "llm",
      label: "LLM 匹配",
      scope: llmScope,
      matched: llmMatchedCount,
      status: deriveStageStatus(llmScope, llmMatchedCount),
    },
  ];

  return {
    total: safeTotal,
    matched,
    stages,
    llmBatch,
  };
};

/**
 * 根据归属信息模糊匹配账本
 * @param flow 流水对象
 * @param userId 用户ID
 * @param candidateBookIds 候选账本ID列表（可选）
 * @returns 匹配到的账本ID和名称，如果未匹配则返回null
 */
async function matchBookByAttribution(
  flow: ParsedFlow,
  userId: number,
  candidateBookIds?: string[]
): Promise<{ bookId: string; bookName: string } | null> {
  const attribution = flow.attribution?.trim();
  if (!attribution) {
    return null;
  }

  // 获取候选账本列表
  const where: any = { userId };
  if (candidateBookIds && candidateBookIds.length > 0) {
    where.bookId = { in: candidateBookIds };
  }

  const books = await prisma.book.findMany({
    where,
    select: {
      bookId: true,
      bookName: true,
    },
  });

  if (books.length === 0) {
    return null;
  }

  // 归一化归属信息（去除空格、转小写）
  const normalizedAttribution = attribution.replace(/\s+/g, "").toLowerCase();

  // 1. 精确匹配（账本ID或账本名称完全匹配）
  for (const book of books) {
    const normalizedBookId = book.bookId.replace(/\s+/g, "").toLowerCase();
    const normalizedBookName = book.bookName.replace(/\s+/g, "").toLowerCase();
    
    if (normalizedAttribution === normalizedBookId || normalizedAttribution === normalizedBookName) {
      return { bookId: book.bookId, bookName: book.bookName };
    }
  }

  // 2. 模糊匹配（包含关系）
  let bestMatch: { book: typeof books[0]; score: number } | null = null;
  
  for (const book of books) {
    const normalizedBookName = book.bookName.replace(/\s+/g, "").toLowerCase();
    
    // 计算匹配分数
    let score = 0;
    
    // 如果归属信息包含账本名称
    if (normalizedAttribution.includes(normalizedBookName)) {
      score = normalizedBookName.length / normalizedAttribution.length;
    }
    // 如果账本名称包含归属信息
    else if (normalizedBookName.includes(normalizedAttribution)) {
      score = normalizedAttribution.length / normalizedBookName.length;
    }
    
    // 只接受匹配度 >= 0.5 的结果
    if (score >= 0.5) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { book, score };
      }
    }
  }

  return bestMatch ? { bookId: bestMatch.book.bookId, bookName: bestMatch.book.bookName } : null;
}

/**
 * 智能导入 - 流水分析接口
 * 
 * 职责：根据流水信息生成账本/分类建议，不直接写库
 * 
 * 当前架构：
 * 1. 规则引擎（RuleEngineService）：根据用户自定义规则和学习生成的规则匹配
 * 2. 账本识别（AccountDetectorService）：基于账本画像计算匹配分数
 * 3. LLM分类（llmFlowClassifier）：当规则引擎和账本识别都无法匹配时，使用LLM补充
 * 
 * 输入：标准流水（ParsedFlow[]）
 * 输出：带建议的流水（包含账本/分类/置信度/命中规则ID等）
 */
export default defineEventHandler(async (event) => {
  const userId = await getUserId(event);
  if (!userId) {
    return error("请先登录");
  }

  let progressToken: string | undefined;
  try {
    const body = await readBody(event);
    const flows = Array.isArray(body?.flows) ? body.flows : [];
    const bookIds: string[] | undefined =
      Array.isArray(body?.bookIds) && body.bookIds.length > 0 ? body.bookIds : undefined;
    const mode: "book" | "category" | "both" = body?.mode || "both"; // 指定模式
    const requestedMatchMode =
      typeof body?.matchMode === "string" ? (body.matchMode as string) : "";
    const matchMode: SmartImportMatchMode =
      requestedMatchMode === "history-only" || requestedMatchMode === "ai-only"
        ? requestedMatchMode
        : "history-first";
    const historyOnlyMode = matchMode === "history-only";
    progressToken =
      typeof body?.progressToken === "string" && body.progressToken.trim().length > 0
        ? body.progressToken.trim()
        : undefined;

    if (flows.length === 0) {
      return error("没有可处理的流水数据");
    }

    const clonedFlows: ParsedFlow[] = flows.map((flow: ParsedFlow) => ({
      ...flow,
      _meta: { ...(flow._meta || {}) },
    }));

    // 当 mode === "book" 时，清除所有流水的账本建议，以便重新匹配所有所选流水的账本信息
    if (mode === "book") {
      let clearedCount = 0;
      for (const flow of clonedFlows) {
        if (flow._meta?.llmSuggestion?.bookId) {
          // 清除账本相关建议，保留分类相关建议（industryType）
          delete flow._meta.llmSuggestion.bookId;
          delete flow._meta.llmSuggestion.bookName;
          clearedCount++;
        }
      }
      if (clearedCount > 0) {
        console.log(`[重新匹配账本] 已清除 ${clearedCount} 条流水的账本建议，将重新匹配`);
      }
    }

    // 若当前用户缺少规则，先尝试基于历史流水生成初始规则
    try {
      const bootstrapResult = await RuleBootstrapService.ensureInitialRules(
        userId
      );
      if (bootstrapResult.created > 0) {
        console.log(
          `[RuleBootstrap] 自动生成 ${bootstrapResult.created}/${bootstrapResult.attempted} 条初始规则`
        );
      } else if (bootstrapResult.skippedReason) {
        console.log(
          `[RuleBootstrap] 跳过初始化（原因: ${bootstrapResult.skippedReason}）`
        );
      } else {
        console.log("[RuleBootstrap] 已尝试初始化规则，但未创建新的规则");
      }
    } catch (bootstrapError: any) {
      console.warn(
        "[RuleBootstrap] 初始化规则失败：",
        bootstrapError?.message || String(bootstrapError)
      );
    }

    let succeeded = 0;
    let total = flows.length;
    let message = "";
    let ruleMatchedCount = 0;
    let attributionMatchedCount = 0;
    let categoryMatchedCount = 0;
    let profileMatchedCount = 0;
    let currentLlmScope = 0;
    let currentLlmMatched = 0;
    let currentLlmBatch: LlmBatchInfo | undefined;

    const emitProgress = (overrides?: {
      llmScope?: number;
      llmMatched?: number;
      llmBatch?: LlmBatchInfo | null;
    }) => {
      if (!progressToken) {
        return;
      }
      if (overrides?.llmScope !== undefined) {
        currentLlmScope = overrides.llmScope;
      }
      if (overrides?.llmMatched !== undefined) {
        currentLlmMatched = overrides.llmMatched;
      }
      if (overrides?.llmBatch !== undefined) {
        currentLlmBatch = overrides.llmBatch || undefined;
      }
      const payload = buildProgressPayload({
        total,
        ruleMatchedCount,
        attributionMatchedCount,
        categoryMatchedCount,
        profileMatchedCount,
        llmScope: currentLlmScope,
        llmMatchedCount: currentLlmMatched,
        llmBatch: currentLlmBatch,
      });
      setProgressPayload(progressToken, payload);
    };

    emitProgress();
    const handleLlmBatchProgress = progressToken
      ? (info: { stage: "book" | "category"; stats: any }) => {
          const llmBatchInfo: LlmBatchInfo = {
            stage: info.stage,
            batchSize: info.stats.batchSize,
            totalBatches: info.stats.totalBatches,
            completedBatches: info.stats.completedBatches,
            failedBatches: info.stats.failedBatches,
            lastBatchSize: info.stats.lastBatchSize,
          };
          emitProgress({ llmBatch: llmBatchInfo });
        }
      : undefined;

    // ========== 阶段1：规则引擎匹配 ==========
    // mode === "book" 时不走规则，只在分类/同时请求时更新分类建议
    if (mode !== "book") {
      console.log(`\n========== [阶段1: 规则引擎匹配] ==========`);
      console.log(`[配置] 流水总数: ${flows.length}`);
      
      for (let i = 0; i < clonedFlows.length; i++) {
        const flow = clonedFlows[i];
        try {
          const ruleMatchResult = await RuleEngineService.match(flow, userId, bookIds);

          if (ruleMatchResult) {
            flow._meta = flow._meta || {};
            const existingSuggestion = flow._meta.llmSuggestion || {};
            flow._meta.llmSuggestion = {
              ...existingSuggestion, // 保留已有账本建议等字段
              flowType: undefined, // 规则引擎不返回 flowType，保持原值
              industryType: ruleMatchResult.categoryId,
              confidence: ruleMatchResult.confidence,
              comment:
                ruleMatchResult.ruleId === -1
                  ? `关键字匹配(${ruleMatchResult.ruleName})`
                  : `规则匹配(${ruleMatchResult.ruleName || `规则#${ruleMatchResult.ruleId}`})`,
              ruleId: ruleMatchResult.ruleId,
            };
            ruleMatchedCount++;
            const matchType = ruleMatchResult.ruleId === -1 ? "关键字匹配" : "规则匹配";
            console.log(`  Flow #${i}: ${matchType}成功 (分类: ${ruleMatchResult.categoryId}, 置信度: ${ruleMatchResult.confidence.toFixed(2)})`);
          }
        } catch (err: any) {
          console.error(`  Flow #${i}: 规则匹配失败:`, err?.message || String(err));
        }

        if (
          progressToken &&
          ((i + 1) % 10 === 0 || i === clonedFlows.length - 1)
        ) {
          emitProgress();
        }
      }

      console.log(`[规则引擎匹配完成] 成功匹配: ${ruleMatchedCount}/${total} 条\n`);
    }

    // 分类建议模式下，仅依赖规则匹配分类，直接返回
    if (mode === "category") {
      const progressPayload = buildProgressPayload({
        total,
        ruleMatchedCount,
        attributionMatchedCount,
        categoryMatchedCount,
        profileMatchedCount,
        llmScope: 0,
        llmMatchedCount: 0,
      });
      if (progressToken) {
        clearProgressPayload(progressToken);
      }
      return success({
        success: true,
        flows: clonedFlows,
        suggestedCount: ruleMatchedCount,
        totalCount: total,
        message: `规则引擎匹配 ${ruleMatchedCount} 条分类建议（仅分类模式，未执行账本/LLM）`,
        ruleMatchedCount,
        profileMatchedCount,
        historyMatchedCount: ruleMatchedCount,
        progress: progressPayload,
      });
    }

    // ========== 阶段2：归属信息模糊匹配 ==========
    // 对于规则引擎未匹配的流水，优先使用归属信息匹配
    // 注意：当 mode === "book" 时，跳过归属匹配，因为归属信息通常只是标记归属人，不应该影响账本匹配
    // 让后续更智能的匹配方法（账本画像、LLM）来处理账本匹配
    if (mode !== "book") {
      console.log(`\n========== [阶段2: 归属信息模糊匹配] ==========`);
      console.log(`[配置] 流水总数: ${flows.length}, 规则已匹配: ${ruleMatchedCount} 条`);
      
      for (let i = 0; i < clonedFlows.length; i++) {
        const flow = clonedFlows[i];
        
        // 如果规则引擎已经匹配，跳过归属匹配
        if (flow._meta?.llmSuggestion?.bookId) {
          continue;
        }
        
        try {
          const matched = await matchBookByAttribution(flow, userId, bookIds);
          if (matched) {
            flow._meta = flow._meta || {};
            flow._meta.llmSuggestion = {
              bookId: matched.bookId,
              bookName: matched.bookName,
              confidence: 0.8, // 归属匹配置信度设为0.8
              comment: `归属信息匹配(${flow.attribution})`,
            };
            attributionMatchedCount++;
            console.log(`  Flow #${i}: 归属信息匹配成功 (账本: ${matched.bookName}, 归属: ${flow.attribution})`);
          }
        } catch (err: any) {
          console.error(`  Flow #${i}: 归属信息匹配失败:`, err?.message || String(err));
        }

        if (
          progressToken &&
          ((i + 1) % 10 === 0 || i === clonedFlows.length - 1)
        ) {
          emitProgress();
        }
      }

      console.log(`[归属信息匹配完成] 成功匹配: ${attributionMatchedCount}/${total} 条\n`);
    } else {
      console.log(`\n========== [阶段2: 归属信息模糊匹配] ==========`);
      console.log(`[配置] mode === "book"，跳过归属匹配阶段，使用更智能的匹配方法`);
      console.log(`[归属信息匹配完成] 已跳过（mode === "book"）\n`);
    }

    // ========== 阶段3：分类匹配（已禁用） ==========
    // 需求：分类匹配功能停用，不计数、不日志

    // ========== 阶段3：分类占比兜底匹配账本（仅 mode === "book"，且无账本建议时） ==========
    let categoryFallbackMatchedCount = 0;
    if (mode === "book") {
      console.log(`\n========== [阶段3: 分类占比兜底匹配账本] ==========`);
      for (let i = 0; i < clonedFlows.length; i++) {
        const flow = clonedFlows[i];
        // 已有账本建议则跳过
        if (flow._meta?.llmSuggestion?.bookId) {
          continue;
        }
        try {
          const matched = await matchBookByCategory(flow, userId, bookIds);
          if (matched) {
            flow._meta = flow._meta || {};
            flow._meta.llmSuggestion = {
              ...(flow._meta.llmSuggestion || {}),
              bookId: matched.bookId,
              bookName: matched.bookName,
              confidence: 0.7, // 兜底置信度沿用 0.7
              comment: `分类占比兜底匹配(${flow.industryType}, 占比: ${(matched.ratio * 100).toFixed(1)}%)`,
            };
            categoryMatchedCount++;
            categoryFallbackMatchedCount++;
            console.log(
              `  Flow #${i}: 分类占比兜底匹配成功 (账本: ${matched.bookName}, 分类: ${flow.industryType}, 占比: ${(matched.ratio * 100).toFixed(1)}%)`
            );
          }
        } catch (err: any) {
          console.error(`  Flow #${i}: 分类占比兜底匹配失败:`, err?.message || String(err));
        }

        if (
          progressToken &&
          ((i + 1) % 10 === 0 || i === clonedFlows.length - 1)
        ) {
          emitProgress();
        }
      }
      console.log(
        `[分类占比兜底匹配完成] 成功匹配: ${categoryFallbackMatchedCount}/${total} 条（仅对未匹配账本的流水尝试）\n`
      );
    }

    // ========== 阶段4：账本画像识别 ==========
    // 对于规则引擎、归属匹配（分类匹配已禁用）都未匹配的流水，使用账本画像识别
    console.log(`\n========== [阶段4: 账本画像识别] ==========`);
    console.log(
      `[配置] 流水总数: ${flows.length}, 规则已匹配: ${ruleMatchedCount} 条, 归属已匹配: ${attributionMatchedCount} 条, 分类已匹配: ${categoryMatchedCount} 条`
    );
    
    for (let i = 0; i < clonedFlows.length; i++) {
      const flow = clonedFlows[i];
      
      const existingBookId = flow._meta?.llmSuggestion?.bookId;
      const existingBookName = flow._meta?.llmSuggestion?.bookName;

      try {
        const detectionResults = await AccountDetectorService.detectAccount(
          flow,
          userId,
          bookIds,
          1 // 只取最高分的账本
        );

        if (detectionResults.length > 0) {
          const bestMatch = detectionResults[0];

          // 若已有账本建议则不覆盖，但若不一致给出提示
          if (existingBookId) {
            if (bestMatch.bookId !== existingBookId) {
              console.warn(
                `  Flow #${i}: 画像建议账本(${bestMatch.bookName}) 与已存在账本(${existingBookName || existingBookId}) 不一致，未覆盖`
              );
            }
            continue;
          }

          // 只接受置信度 >= 0.5 的匹配结果
          if (bestMatch.confidence >= 0.5) {
            flow._meta = flow._meta || {};
            flow._meta.llmSuggestion = {
              ...(flow._meta.llmSuggestion || {}),
              bookId: bestMatch.bookId,
              bookName: bestMatch.bookName,
              confidence: bestMatch.confidence,
              comment: `账本画像匹配(分数: ${bestMatch.score.toFixed(2)})`,
            };
            profileMatchedCount++;
            console.log(
              `  Flow #${i}: 账本画像匹配成功 (账本: ${bestMatch.bookName}, 分数: ${bestMatch.score.toFixed(2)}, 置信度: ${bestMatch.confidence.toFixed(2)})`
            );
          }
        }
      } catch (err: any) {
        console.error(`  Flow #${i}: 账本画像识别失败:`, err?.message || String(err));
      }

      if (
        progressToken &&
        ((i + 1) % 10 === 0 || i === clonedFlows.length - 1)
      ) {
        emitProgress();
      }
    }

    console.log(`[账本画像识别完成] 成功匹配: ${profileMatchedCount}/${total} 条\n`);

    // 仅获取账本建议模式下，返回分类兜底 + 画像结果
    if (mode === "book") {
      const historyMatchedCount =
        ruleMatchedCount + attributionMatchedCount + categoryMatchedCount + profileMatchedCount;
      const progressPayload = buildProgressPayload({
        total,
        ruleMatchedCount,
        attributionMatchedCount,
        categoryMatchedCount,
        profileMatchedCount,
        llmScope: 0,
        llmMatchedCount: 0,
      });
      if (progressToken) {
        clearProgressPayload(progressToken);
      }
      return success({
        success: true,
        flows: clonedFlows,
        suggestedCount: historyMatchedCount,
        totalCount: total,
        message: `账本画像匹配 ${profileMatchedCount} 条，分类占比兜底匹配 ${categoryFallbackMatchedCount} 条（仅账本模式，未执行规则/LLM）`,
        ruleMatchedCount,
        profileMatchedCount,
        historyMatchedCount,
        progress: progressPayload,
      });
    }

    const historyMatchedCount =
      ruleMatchedCount + attributionMatchedCount + categoryMatchedCount + profileMatchedCount;

    // ========== 阶段3：LLM分类补充 ==========
    // 对于规则引擎和账本画像都未匹配的流水，使用LLM补充
    const flowsNeedingAI = clonedFlows.filter(
      (flow) => !flow._meta?.llmSuggestion?.bookId
    );
    emitProgress({
      llmScope: historyOnlyMode ? 0 : flowsNeedingAI.length,
      llmMatched: 0,
      llmBatch: null,
    });

    if (historyOnlyMode) {
      const progressPayload = buildProgressPayload({
        total,
        ruleMatchedCount,
        attributionMatchedCount,
        categoryMatchedCount,
        profileMatchedCount,
        llmScope: 0,
        llmMatchedCount: 0,
      });
      if (progressToken) {
        clearProgressPayload(progressToken);
      }
      return success({
        success: true,
        flows: clonedFlows,
        suggestedCount: historyMatchedCount,
        totalCount: total,
        message: `历史匹配模式：规则引擎匹配 ${ruleMatchedCount} 条，归属匹配 ${attributionMatchedCount} 条，分类匹配 ${categoryMatchedCount} 条，账本画像匹配 ${profileMatchedCount} 条，已跳过 AI 分类`,
        ruleMatchedCount,
        profileMatchedCount,
        historyMatchedCount,
        progress: progressPayload,
      });
    }

    if (flowsNeedingAI.length === 0) {
      // 所有流水都已通过规则引擎、归属匹配、分类匹配或账本画像匹配完成
      const progressPayload = buildProgressPayload({
        total,
        ruleMatchedCount,
        attributionMatchedCount,
        categoryMatchedCount,
        profileMatchedCount,
        llmScope: 0,
        llmMatchedCount: 0,
      });
      if (progressToken) {
        clearProgressPayload(progressToken);
      }
      return success({
        success: true,
        flows: clonedFlows,
        suggestedCount: historyMatchedCount,
        totalCount: total,
        message: `规则引擎匹配 ${ruleMatchedCount} 条，归属匹配 ${attributionMatchedCount} 条，分类匹配 ${categoryMatchedCount} 条，账本画像匹配 ${profileMatchedCount} 条`,
        ruleMatchedCount,
        profileMatchedCount,
        historyMatchedCount,
        progress: progressPayload,
      });
    }

    // 如果没有配置AI服务，直接返回规则引擎、归属匹配、分类匹配和账本画像匹配结果
    if (!process.env.LLM_BASE_URL) {
      const progressPayload = buildProgressPayload({
        total,
        ruleMatchedCount,
        attributionMatchedCount,
        categoryMatchedCount,
        profileMatchedCount,
        llmScope: flowsNeedingAI.length,
        llmMatchedCount: 0,
      });
      if (progressToken) {
        clearProgressPayload(progressToken);
      }
      return success({
        success: true,
        flows: clonedFlows,
        suggestedCount: historyMatchedCount,
        totalCount: total,
        message: `规则引擎匹配 ${ruleMatchedCount} 条，归属匹配 ${attributionMatchedCount} 条，分类匹配 ${categoryMatchedCount} 条，账本画像匹配 ${profileMatchedCount} 条（未配置AI服务，无法处理剩余 ${flowsNeedingAI.length} 条）`,
        ruleMatchedCount,
        profileMatchedCount,
        historyMatchedCount,
        progress: progressPayload,
      });
    }

    console.log(`[阶段3: LLM分类补充] 需要AI处理的流水: ${flowsNeedingAI.length} 条\n`);

    let llmBatch: LlmBatchInfo | undefined;

    // 此处仅在 mode === "both" 执行（其他模式已提前返回）
    const result = await applyLlmSuggestions(flowsNeedingAI, {
      userId,
      candidateBookIds: bookIds,
      onBatchProgress: handleLlmBatchProgress,
    });
    succeeded = result.succeeded;
    llmBatch = result.batchInfo;
    message =
      historyMatchedCount > 0
        ? `规则引擎匹配 ${ruleMatchedCount} 条，归属匹配 ${attributionMatchedCount} 条，分类匹配 ${categoryMatchedCount} 条，账本画像匹配 ${profileMatchedCount} 条，AI 补充 ${succeeded} 条建议`
        : succeeded === total
        ? `AI 返回 ${succeeded} 条建议`
        : `AI 返回 ${succeeded}/${total} 条建议（部分请求可能因网络问题失败）`;
    emitProgress({ llmMatched: succeeded, llmBatch });

    // ========== 返回结果 ==========
    // 注意：此接口只返回建议，不直接写库
    // 用户在前端确认后，通过 smart-import-commit 接口提交导入
    const totalSuggested = historyMatchedCount + succeeded;
    if (totalSuggested > 0) {
      const progressPayload = buildProgressPayload({
        total,
        ruleMatchedCount,
        attributionMatchedCount,
        categoryMatchedCount,
        profileMatchedCount,
        llmScope: flowsNeedingAI.length,
        llmMatchedCount: succeeded,
        llmBatch,
      });
    if (progressToken) {
      clearProgressPayload(progressToken);
    }
      return success({
        success: true,
        flows: clonedFlows, // 返回带建议的流水，前端展示供用户确认
        suggestedCount: totalSuggested,
        totalCount: total,
        message,
        ruleMatchedCount,
        profileMatchedCount,
        historyMatchedCount,
        progress: progressPayload,
      });
    }

    // 全部失败时才返回错误
  if (progressToken) {
    clearProgressPayload(progressToken);
  }
    return error("规则引擎、账本画像和AI服务都暂时不可用，请检查网络连接或稍后重试");
  } catch (err: any) {
    console.error("[smart-import-ai] 处理失败:", err);
    const errorMessage = err?.message || "获取 AI 建议失败，请重试";
  if (progressToken) {
    clearProgressPayload(progressToken);
  }
    
    // 如果是超时或网络错误，提供更友好的提示
    if (errorMessage.includes("超时") || errorMessage.includes("连接失败") || errorMessage.includes("timeout")) {
      return error("AI 服务响应超时，请检查网络连接或稍后重试");
    }
    
    return error(errorMessage);
  }
});


