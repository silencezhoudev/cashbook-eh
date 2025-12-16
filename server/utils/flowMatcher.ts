import prisma from "~/lib/prisma";
import type { ParsedFlow } from "./flowParser";

/**
 * 匹配结果
 */
export interface FlowMatchResult {
  bookId?: string;
  bookName?: string;
  flowType?: string;
  industryType?: string;
  primaryCategory?: string;
  secondaryCategory?: string;
  attribution?: string;
  description?: string;
  confidence: number;
  matchMethod: "exact" | "similar" | "fuzzy" | "distribution";
  matchDetails?: {
    matchedFlowsCount: number;
    matchedFields: string[];
  };
}

/**
 * 匹配选项
 */
export interface FlowMatchOptions {
  userId: number;
  candidateBookIds?: string[];
  minConfidence?: number; // 最低置信度阈值，默认0.3
  maxResults?: number; // 每个账本最多返回的匹配流水数，默认10
}

/**
 * 基于历史流水匹配账本和分类
 */
export class FlowMatcher {
  /**
   * 为单条流水匹配账本和分类
   */
  static async matchFlow(
    flow: ParsedFlow,
    options: FlowMatchOptions
  ): Promise<FlowMatchResult | null> {
    const minConfidence = options.minConfidence ?? 0.3;
    const maxResults = options.maxResults ?? 10;

    // 1. 构建查询条件
    const where: any = {
      userId: options.userId,
    };

    if (options.candidateBookIds && options.candidateBookIds.length > 0) {
      where.bookId = { in: options.candidateBookIds };
    }

    // 2. 尝试精确匹配（交易对象、分类、金额都相同）
    const exactMatch = await this.findExactMatch(flow, where, maxResults);
    if (exactMatch && exactMatch.confidence >= minConfidence) {
      return exactMatch;
    }

    // 3. 尝试相似匹配（交易对象相似，金额相近）
    const similarMatch = await this.findSimilarMatch(flow, where, maxResults);
    if (similarMatch && similarMatch.confidence >= minConfidence) {
      return similarMatch;
    }

    // 4. 尝试模糊匹配（交易对象包含关键词）
    const fuzzyMatch = await this.findFuzzyMatch(flow, where, maxResults);
    if (fuzzyMatch && fuzzyMatch.confidence >= minConfidence) {
      return fuzzyMatch;
    }

    // 5. 尝试分布匹配（根据账本的历史分类分布）
    const distributionMatch = await this.findDistributionMatch(flow, where);
    if (distributionMatch && distributionMatch.confidence >= minConfidence) {
      return distributionMatch;
    }

    return null;
  }

  /**
   * 精确匹配：交易对象、分类、金额都相同
   */
  private static async findExactMatch(
    flow: ParsedFlow,
    where: any,
    maxResults: number
  ): Promise<FlowMatchResult | null> {
    if (!flow.name || !flow.industryType) {
      return null;
    }

    const matchedFlows = await prisma.flow.findMany({
      where: {
        ...where,
        name: flow.name,
        industryType: flow.industryType,
        // 金额允许±1%的误差
        money: {
          gte: flow.money * 0.99,
          lte: flow.money * 1.01,
        },
      },
      take: maxResults,
      orderBy: { day: "desc" },
      select: {
        bookId: true,
        flowType: true,
        industryType: true,
        attribution: true,
      },
    });

    if (matchedFlows.length === 0) {
      return null;
    }

    // 统计每个账本的出现次数
    const bookStats = this.countByBook(matchedFlows);
    const bestBook = this.selectBestBook(bookStats);

    if (!bestBook) {
      return null;
    }

    // 获取账本名称
    const book = await prisma.book.findUnique({
      where: { bookId: bestBook.bookId },
      select: { bookName: true },
    });

    // 解析分类
    const { primaryCategory, secondaryCategory } = this.parseIndustryType(
      bestBook.industryType || flow.industryType
    );

    return {
      bookId: bestBook.bookId,
      bookName: book?.bookName,
      flowType: bestBook.flowType || flow.flowType,
      industryType: bestBook.industryType || flow.industryType,
      primaryCategory,
      secondaryCategory,
      attribution: bestBook.attribution,
      description: flow.description,
      confidence: Math.min(0.95, 0.7 + bestBook.count * 0.05), // 匹配次数越多，置信度越高
      matchMethod: "exact",
      matchDetails: {
        matchedFlowsCount: matchedFlows.length,
        matchedFields: ["name", "industryType", "money"],
      },
    };
  }

  /**
   * 相似匹配：交易对象相似，金额相近（±10%）
   */
  private static async findSimilarMatch(
    flow: ParsedFlow,
    where: any,
    maxResults: number
  ): Promise<FlowMatchResult | null> {
    if (!flow.name) {
      return null;
    }

    // 提取交易对象的关键词
    const keywords = this.extractKeywords(flow.name);
    if (keywords.length === 0) {
      return null;
    }

    // 构建查询：交易对象包含关键词
    const nameConditions = keywords.map((keyword) => ({
      name: { contains: keyword },
    }));

    const matchedFlows = await prisma.flow.findMany({
      where: {
        ...where,
        OR: nameConditions,
        // 金额允许±10%的误差
        money: {
          gte: flow.money * 0.9,
          lte: flow.money * 1.1,
        },
      },
      take: maxResults * 2, // 多取一些，因为相似匹配可能匹配到更多
      orderBy: { day: "desc" },
      select: {
        bookId: true,
        flowType: true,
        industryType: true,
        attribution: true,
        name: true,
      },
    });

    if (matchedFlows.length === 0) {
      return null;
    }

    // 计算相似度并排序
    const scoredFlows = matchedFlows
      .map((f) => ({
        ...f,
        similarity: this.calculateSimilarity(flow.name || "", f.name || ""),
      }))
      .filter((f) => f.similarity >= 0.5) // 相似度阈值
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);

    if (scoredFlows.length === 0) {
      return null;
    }

    // 统计每个账本的出现次数（加权）
    const bookStats = new Map<
      string,
      {
        bookId: string;
        count: number;
        totalSimilarity: number;
        flowType?: string;
        industryType?: string;
        attribution?: string;
      }
    >();

    for (const f of scoredFlows) {
      const existing = bookStats.get(f.bookId);
      if (existing) {
        existing.count += 1;
        existing.totalSimilarity += f.similarity;
        // 更新最常见的分类
        if (f.industryType && !existing.industryType) {
          existing.industryType = f.industryType;
        }
        if (f.flowType && !existing.flowType) {
          existing.flowType = f.flowType;
        }
        if (f.attribution && !existing.attribution) {
          existing.attribution = f.attribution;
        }
      } else {
        bookStats.set(f.bookId, {
          bookId: f.bookId,
          count: 1,
          totalSimilarity: f.similarity,
          flowType: f.flowType || undefined,
          industryType: f.industryType || undefined,
          attribution: f.attribution || undefined,
        });
      }
    }

    // 选择最佳账本（综合考虑匹配次数和相似度）
    let bestBook: {
      bookId: string;
      avgSimilarity: number;
      count: number;
      flowType?: string;
      industryType?: string;
      attribution?: string;
    } | null = null;
    let bestScore = 0;

    for (const [bookId, stats] of bookStats.entries()) {
      const avgSimilarity = stats.totalSimilarity / stats.count;
      const score = stats.count * 0.5 + avgSimilarity * 0.5; // 平衡匹配次数和相似度

      if (score > bestScore) {
        bestScore = score;
        bestBook = {
          bookId: stats.bookId,
          avgSimilarity,
          count: stats.count,
          flowType: stats.flowType,
          industryType: stats.industryType,
          attribution: stats.attribution,
        };
      }
    }

    if (!bestBook) {
      return null;
    }

    // 获取账本名称
    const book = await prisma.book.findUnique({
      where: { bookId: bestBook.bookId },
      select: { bookName: true },
    });

    // 解析分类
    const { primaryCategory, secondaryCategory } = this.parseIndustryType(
      bestBook.industryType || flow.industryType || ""
    );

    return {
      bookId: bestBook.bookId,
      bookName: book?.bookName,
      flowType: bestBook.flowType || flow.flowType,
      industryType: bestBook.industryType || flow.industryType,
      primaryCategory,
      secondaryCategory,
      attribution: bestBook.attribution,
      description: flow.description,
      confidence: Math.min(0.85, 0.5 + bestBook.avgSimilarity * 0.3 + bestBook.count * 0.02),
      matchMethod: "similar",
      matchDetails: {
        matchedFlowsCount: scoredFlows.length,
        matchedFields: ["name", "money"],
      },
    };
  }

  /**
   * 模糊匹配：交易对象包含关键词
   */
  private static async findFuzzyMatch(
    flow: ParsedFlow,
    where: any,
    maxResults: number
  ): Promise<FlowMatchResult | null> {
    if (!flow.name) {
      return null;
    }

    // 提取关键词（更宽松）
    const keywords = this.extractKeywords(flow.name, true);
    if (keywords.length === 0) {
      return null;
    }

    // 构建查询：交易对象包含任一关键词
    const nameConditions = keywords.map((keyword) => ({
      name: { contains: keyword },
    }));

    const matchedFlows = await prisma.flow.findMany({
      where: {
        ...where,
        OR: nameConditions,
      },
      take: maxResults * 3,
      orderBy: { day: "desc" },
      select: {
        bookId: true,
        flowType: true,
        industryType: true,
        attribution: true,
      },
    });

    if (matchedFlows.length === 0) {
      return null;
    }

    // 统计每个账本和分类的组合
    const bookStats = this.countByBook(matchedFlows);
    const bestBook = this.selectBestBook(bookStats);

    if (!bestBook) {
      return null;
    }

    // 获取账本名称
    const book = await prisma.book.findUnique({
      where: { bookId: bestBook.bookId },
      select: { bookName: true },
    });

    // 解析分类
    const { primaryCategory, secondaryCategory } = this.parseIndustryType(
      bestBook.industryType || flow.industryType || ""
    );

    return {
      bookId: bestBook.bookId,
      bookName: book?.bookName,
      flowType: bestBook.flowType || flow.flowType,
      industryType: bestBook.industryType || flow.industryType,
      primaryCategory,
      secondaryCategory,
      attribution: bestBook.attribution,
      description: flow.description,
      confidence: Math.min(0.7, 0.4 + bestBook.count * 0.03),
      matchMethod: "fuzzy",
      matchDetails: {
        matchedFlowsCount: matchedFlows.length,
        matchedFields: ["name"],
      },
    };
  }

  /**
   * 分布匹配：根据账本的历史分类分布
   */
  private static async findDistributionMatch(
    flow: ParsedFlow,
    where: any
  ): Promise<FlowMatchResult | null> {
    if (!flow.industryType) {
      return null;
    }

    // 获取所有候选账本
    const books = await prisma.book.findMany({
      where: {
        userId: where.userId,
        ...(where.bookId ? { bookId: where.bookId } : {}),
      },
      select: { bookId: true, bookName: true },
    });

    if (books.length === 0) {
      return null;
    }

    // 解析当前分类
    const { primaryCategory, secondaryCategory } = this.parseIndustryType(flow.industryType);

    // 统计每个账本中该分类的出现次数
    const bookScores = new Map<
      string,
      {
        bookId: string;
        bookName: string;
        count: number;
        totalFlows: number;
        ratio: number;
      }
    >();

    for (const book of books) {
      // 统计该账本中该分类的流水数
      const categoryCount = await prisma.flow.count({
        where: {
          ...where,
          bookId: book.bookId,
          industryType: flow.industryType,
        },
      });

      // 统计该账本的总流水数
      const totalCount = await prisma.flow.count({
        where: {
          ...where,
          bookId: book.bookId,
        },
      });

      if (totalCount > 0) {
        const ratio = categoryCount / totalCount;
        bookScores.set(book.bookId, {
          bookId: book.bookId,
          bookName: book.bookName,
          count: categoryCount,
          totalFlows: totalCount,
          ratio,
        });
      }
    }

    if (bookScores.size === 0) {
      return null;
    }

    // 选择比例最高的账本
    let bestBook: {
      bookId: string;
      bookName: string;
      count: number;
      ratio: number;
    } | null = null;
    let bestRatio = 0;

    for (const [bookId, stats] of bookScores.entries()) {
      if (stats.ratio > bestRatio) {
        bestRatio = stats.ratio;
        bestBook = stats;
      }
    }

    if (!bestBook || bestBook.count === 0) {
      return null;
    }

    // 获取最常见的 flowType 和 attribution
    const sampleFlows = await prisma.flow.findMany({
      where: {
        ...where,
        bookId: bestBook.bookId,
        industryType: flow.industryType,
      },
      take: 10,
      select: {
        flowType: true,
        attribution: true,
      },
    });

    const mostCommonFlowType = this.getMostCommon(sampleFlows.map((f) => f.flowType).filter(Boolean));
    const mostCommonAttribution = this.getMostCommon(
      sampleFlows.map((f) => f.attribution).filter(Boolean)
    );

    return {
      bookId: bestBook.bookId,
      bookName: bestBook.bookName,
      flowType: mostCommonFlowType || flow.flowType,
      industryType: flow.industryType,
      primaryCategory,
      secondaryCategory,
      attribution: mostCommonAttribution,
      description: flow.description,
      confidence: Math.min(0.6, 0.3 + bestRatio * 0.5),
      matchMethod: "distribution",
      matchDetails: {
        matchedFlowsCount: bestBook.count,
        matchedFields: ["industryType"],
      },
    };
  }

  /**
   * 提取关键词（用于匹配）
   */
  private static extractKeywords(text: string, loose: boolean = false): string[] {
    if (!text) return [];

    // 移除常见无意义字符
    let cleaned = text
      .replace(/[（()）【】\[\]【】]/g, "")
      .replace(/\s+/g, "")
      .trim();

    if (cleaned.length === 0) return [];

    // 如果是严格模式，提取2-4个字符的关键词
    if (!loose) {
      const keywords: string[] = [];
      // 提取2-4字的关键词
      for (let len = 4; len >= 2; len--) {
        for (let i = 0; i <= cleaned.length - len; i++) {
          const keyword = cleaned.substring(i, i + len);
          if (keyword.length >= 2) {
            keywords.push(keyword);
          }
        }
      }
      return keywords.slice(0, 5); // 最多返回5个关键词
    } else {
      // 宽松模式：提取单个字符（中文）或单词（英文）
      const keywords: string[] = [];
      // 提取2-3字的关键词
      for (let len = 3; len >= 2; len--) {
        for (let i = 0; i <= cleaned.length - len; i++) {
          const keyword = cleaned.substring(i, i + len);
          keywords.push(keyword);
        }
      }
      return keywords.slice(0, 10); // 最多返回10个关键词
    }
  }

  /**
   * 计算字符串相似度（简单的编辑距离算法）
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    // 如果较短的字符串是较长字符串的子串，返回较高相似度
    if (longer.includes(shorter)) {
      return shorter.length / longer.length;
    }

    // 简单的字符重叠度计算
    let matches = 0;
    const shorterSet = new Set(shorter);
    for (const char of longer) {
      if (shorterSet.has(char)) {
        matches++;
      }
    }

    return matches / Math.max(longer.length, shorter.length);
  }

  /**
   * 统计每个账本的出现次数
   */
  private static countByBook(
    flows: Array<{
      bookId: string;
      flowType?: string | null;
      industryType?: string | null;
      attribution?: string | null;
    }>
  ): Map<
    string,
    {
      bookId: string;
      count: number;
      flowType?: string;
      industryType?: string;
      attribution?: string;
    }
  > {
    const stats = new Map<
      string,
      {
        bookId: string;
        count: number;
        flowType?: string;
        industryType?: string;
        attribution?: string;
      }
    >();

    for (const flow of flows) {
      const existing = stats.get(flow.bookId);
      if (existing) {
        existing.count += 1;
        // 更新最常见的分类
        if (flow.industryType && !existing.industryType) {
          existing.industryType = flow.industryType;
        }
        if (flow.flowType && !existing.flowType) {
          existing.flowType = flow.flowType;
        }
        if (flow.attribution && !existing.attribution) {
          existing.attribution = flow.attribution;
        }
      } else {
        stats.set(flow.bookId, {
          bookId: flow.bookId,
          count: 1,
          flowType: flow.flowType || undefined,
          industryType: flow.industryType || undefined,
          attribution: flow.attribution || undefined,
        });
      }
    }

    return stats;
  }

  /**
   * 选择最佳账本（出现次数最多的）
   */
  private static selectBestBook(
    stats: Map<
      string,
      {
        bookId: string;
        count: number;
        flowType?: string;
        industryType?: string;
        attribution?: string;
      }
    >
  ): {
    bookId: string;
    count: number;
    flowType?: string;
    industryType?: string;
    attribution?: string;
  } | null {
    let best: {
      bookId: string;
      count: number;
      flowType?: string;
      industryType?: string;
      attribution?: string;
    } | null = null;

    for (const [bookId, stat] of stats.entries()) {
      if (!best || stat.count > best.count) {
        best = stat;
      }
    }

    return best;
  }

  /**
   * 解析分类（支持"一级/二级"格式）
   */
  private static parseIndustryType(industryType: string): {
    primaryCategory: string;
    secondaryCategory?: string;
  } {
    if (!industryType) {
      return { primaryCategory: "" };
    }

    if (industryType.includes("/")) {
      const parts = industryType.split("/");
      return {
        primaryCategory: parts[0].trim(),
        secondaryCategory: parts[1]?.trim(),
      };
    }

    return { primaryCategory: industryType.trim() };
  }

  /**
   * 获取最常见的值
   */
  private static getMostCommon(values: (string | null | undefined)[]): string | undefined {
    const counts = new Map<string, number>();
    for (const value of values) {
      if (value) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }

    let mostCommon: string | undefined;
    let maxCount = 0;

    for (const [value, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = value;
      }
    }

    return mostCommon;
  }
}

