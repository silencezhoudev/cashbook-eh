import prisma from "~/lib/prisma";
import { AccountProfileService } from "./accountProfileService";
import type { ParsedFlow } from "./flowParser";

/**
 * 账本识别结果
 */
export interface BookDetectionResult {
  bookId: string;
  bookName: string;
  score: number; // 匹配分数（0-100）
  confidence: number; // 置信度（0-1）
  factors: {
    merchantMatch: number; // 交易方匹配分数
    keywordMatch: number; // 关键词匹配分数
    amountMatch: number; // 金额匹配分数
    payTypeMatch: number; // 支付方式匹配分数
  };
}

/**
 * 打分权重配置（可扩展）
 */
interface ScoringWeights {
  merchantMatch: number; // 交易方匹配权重（默认30%）
  keywordMatch: number; // 关键词匹配权重（默认25%）
  amountMatch: number; // 金额匹配权重（默认25%）
  payTypeMatch: number; // 支付方式匹配权重（默认20%）
}

// 优化后的权重配置：以关键词为主，降低金额和支付方式的权重
const DEFAULT_WEIGHTS: ScoringWeights = {
  merchantMatch: 0.35,      // 交易方匹配：30%（提高）
  keywordMatch: 0.45,      // 关键词匹配：35%（提高）
  amountMatch: 0.1,        // 金额匹配：10%（降低）
  payTypeMatch: 0.1,      // 支付方式匹配：15%（降低）
};

/**
 * 账本识别服务
 * 根据账本画像识别流水所属的账本
 */
export class AccountDetectorService {
  /**
   * 检测流水所属的账本
   * @param flow 标准流水对象
   * @param userId 用户ID
   * @param candidateBookIds 候选账本ID列表（可选，用于限制识别范围）
   * @param maxResults 最大返回结果数（默认5）
   * @param weights 打分权重配置（可选）
   * @returns 候选账本列表，按分数降序排列
   */
  static async detectAccount(
    flow: ParsedFlow,
    userId: number,
    candidateBookIds?: string[],
    maxResults: number = 5,
    weights: ScoringWeights = DEFAULT_WEIGHTS
  ): Promise<BookDetectionResult[]> {
    // 1. 获取候选账本列表
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
      return [];
    }

    // 预生成账户名称停用词，避免账户名进入分词
    const accountStopWords =
      await AccountProfileService.getAccountStopWordsForUser(userId);

    // 预提取流水关键词，供关键词匹配复用
    const flowKeywords = this.extractFlowKeywords(flow, accountStopWords);

    // 2. 为每个账本计算匹配分数
    const results: BookDetectionResult[] = [];

    for (const book of books) {
      // 获取账本画像
      let profile = await AccountProfileService.getProfile(userId, book.bookId);

      // 如果画像不存在，尝试重建（可选：也可以跳过）
      if (!profile || profile.totalFlows === 0) {
        // 跳过没有画像的账本，或者可以选择重建
        continue;
      }

      // 计算各项匹配分数
      const factors = {
        merchantMatch: this.scoreMerchantMatch(flow, profile),
        keywordMatch: this.scoreKeywordMatch(flowKeywords, profile),
        amountMatch: this.scoreAmountMatch(flow, profile),
        payTypeMatch: this.scorePayTypeMatch(flow, profile),
      };

      // 计算加权总分
      const score =
        factors.merchantMatch * weights.merchantMatch +
        factors.keywordMatch * weights.keywordMatch +
        factors.amountMatch * weights.amountMatch +
        factors.payTypeMatch * weights.payTypeMatch;

      // 计算置信度（基于分数和画像数据量）
      const confidence = this.calculateConfidence(score, profile);

      // 只返回分数大于0的结果
      if (score > 0) {
        results.push({
          bookId: book.bookId,
          bookName: book.bookName,
          score: Math.round(score * 100) / 100, // 保留2位小数
          confidence,
          factors,
        });
      }
    }

    // 3. 按分数降序排序，返回top N
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults);
  }

  /**
   * 计算交易方匹配分数（0-1）
   * 逻辑：检查流水的交易方是否出现在账本的历史交易方关键词中
   * 增强：支持部分匹配和模糊匹配
   */
  private static scoreMerchantMatch(
    flow: ParsedFlow,
    profile: Awaited<ReturnType<typeof AccountProfileService.getProfile>>
  ): number {
    if (!flow.name || !profile || Object.keys(profile.merchantKeywords).length === 0) {
      return 0;
    }

    const merchantName = flow.name.toLowerCase().trim();
    const keywords = Object.keys(profile.merchantKeywords);
    let bestScore = 0;
    const maxWeight = Math.max(...Object.values(profile.merchantKeywords));

    if (maxWeight === 0) {
      return 0;
    }

    // 检查是否完全匹配或包含匹配
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase().trim();
      const weight = profile.merchantKeywords[keyword] || 0;
      const normalizedWeight = weight / maxWeight;

      // 完全匹配，返回高分
      if (merchantName === keywordLower) {
        return 1.0;
      }

      // 包含匹配（双向）
      if (merchantName.includes(keywordLower)) {
        // 如果关键词在交易方名称中，根据关键词权重和长度计算分数
        const lengthRatio = keywordLower.length / merchantName.length;
        const score = normalizedWeight * (0.7 + lengthRatio * 0.3); // 长度越长，分数越高
        bestScore = Math.max(bestScore, Math.min(0.95, score));
      } else if (keywordLower.includes(merchantName)) {
        // 如果交易方名称是关键词的一部分
        const lengthRatio = merchantName.length / keywordLower.length;
        const score = normalizedWeight * (0.6 + lengthRatio * 0.3);
        bestScore = Math.max(bestScore, Math.min(0.9, score));
      }
    }

    return bestScore;
  }

  /**
   * 计算关键词匹配分数（0-1）
   * 逻辑：检查流水的备注、交易方、账户名称中包含该账本常见关键词的数量
   * 增强：从多个字段匹配（description, name, accountName）
   */
  private static scoreKeywordMatch(
    flowKeywords: string[],
    profile: Awaited<ReturnType<typeof AccountProfileService.getProfile>>
  ): number {
    if (!profile || Object.keys(profile.merchantKeywords).length === 0) {
      return 0;
    }
    if (!flowKeywords || flowKeywords.length === 0) {
      return 0;
    }

    const keywords = Object.keys(profile.merchantKeywords);
    let matchCount = 0;
    let totalWeight = 0;
    const matchedKeywords: string[] = [];

    const flowKeywordSet = new Set(flowKeywords.map((k) => k.toLowerCase()));

    // 检查分词结果是否命中画像高频词
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase().trim();
      if (!flowKeywordSet.has(keywordLower)) {
        continue;
      }
      matchCount++;
      const weight = profile.merchantKeywords[keyword] || 0;
      totalWeight += weight;
      matchedKeywords.push(keyword);
    }

    if (matchCount === 0) {
      return 0;
    }

    // 计算分数
    const maxWeight = Math.max(...Object.values(profile.merchantKeywords));
    if (maxWeight === 0) {
      return 0;
    }

    // 权重得分：基于匹配关键词的总权重
    const weightScore = Math.min(1.0, totalWeight / (maxWeight * 2)); // 最多2倍权重得满分

    // 数量得分：匹配的关键词越多越好，但边际效应递减
    const countScore = Math.min(1.0, 0.3 + (matchCount / 5) * 0.7); // 5个关键词得满分

    // 综合得分：权重60%，数量40%
    return weightScore * 0.6 + countScore * 0.4;
  }

  /**
   * 提取流水的关键词（商品/备注/交易对方等）
   */
  private static extractFlowKeywords(
    flow: ParsedFlow,
    accountStopWords?: Set<string>
  ): string[] {
    const segments = [
      flow.name,
      flow.description,
      flow.counterparty,
      flow.accountName,
      flow.origin,
    ];
    try {
      return AccountProfileService.extractFlowKeywords(segments, accountStopWords);
    } catch {
      // 保底避免分词异常影响流程
      return [];
    }
  }

  /**
   * 计算金额匹配分数（0-1）
   * 逻辑：检查金额是否落在该账本历史金额分布的高频区间
   * 优化：降低金额匹配的权重和分数，因为金额匹配不够准确
   */
  private static scoreAmountMatch(
    flow: ParsedFlow,
    profile: Awaited<ReturnType<typeof AccountProfileService.getProfile>>
  ): number {
    if (!flow.money || flow.money <= 0 || !profile) {
      return 0;
    }

    const amount = flow.money;
    const distribution = profile.amountDistribution;

    if (Object.keys(distribution).length === 0) {
      return 0;
    }

    // 确定金额所属的区间
    const range = this.getAmountRange(amount);
    const rangeCount = distribution[range] || 0;

    // 计算该区间的占比
    const totalCount = Object.values(distribution).reduce((a, b) => a + b, 0);
    if (totalCount === 0) {
      return 0;
    }

    const ratio = rangeCount / totalCount;

    // 如果该区间占比超过30%，认为匹配度较高（提高阈值）
    if (ratio >= 0.3) {
      return Math.min(0.8, ratio * 1.5); // 最高0.8分
    }

    // 如果占比较低，给一个较低的分数（降低分数上限）
    return Math.min(0.5, ratio * 2); // 最多0.5分
  }

  /**
   * 计算支付方式匹配分数（0-1）
   * 逻辑：检查支付方式是否与该账本常用支付方式匹配
   */
  private static scorePayTypeMatch(
    flow: ParsedFlow,
    profile: Awaited<ReturnType<typeof AccountProfileService.getProfile>>
  ): number {
    if (!flow.payType || !profile) {
      return 0;
    }

    const payType = flow.payType.toLowerCase();
    const payTypeStats = profile.payTypeStats;

    if (Object.keys(payTypeStats).length === 0) {
      return 0;
    }

    // 检查是否完全匹配
    for (const [type, count] of Object.entries(payTypeStats)) {
      if (type.toLowerCase() === payType) {
        // 计算该支付方式的占比
        const totalCount = Object.values(payTypeStats).reduce((a, b) => a + b, 0);
        const ratio = count / totalCount;

        // 如果占比超过30%，认为匹配度高
        if (ratio >= 0.3) {
          return 1.0;
        }

        // 否则按比例给分
        return ratio * 2; // 最多0.6分
      }
    }

    return 0;
  }

  /**
   * 获取金额所属的区间
   */
  private static getAmountRange(amount: number): string {
    if (amount < 50) return "0-50";
    if (amount < 200) return "50-200";
    if (amount < 500) return "200-500";
    if (amount < 1000) return "500-1000";
    return "1000+";
  }

  /**
   * 计算置信度（0-1）
   * 基于分数和画像数据量
   */
  private static calculateConfidence(
    score: number,
    profile: Awaited<ReturnType<typeof AccountProfileService.getProfile>>
  ): number {
    if (!profile) {
      return 0;
    }

    // 基础置信度：基于分数
    let confidence = score;

    // 数据量影响：流水越多，置信度越高
    if (profile.totalFlows > 0) {
      const dataQuality = Math.min(profile.totalFlows / 100, 1.0); // 100条流水为满分
      confidence = confidence * 0.7 + dataQuality * 0.3; // 分数70%，数据量30%
    }

    // 限制在合理范围内
    return Math.max(0.3, Math.min(0.95, confidence));
  }
}

