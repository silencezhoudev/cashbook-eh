import type { Flow } from "@prisma/client";
import prisma from "~/lib/prisma";
import type { ParsedFlow } from "./flowParser";
import { RuleLearnerService } from "./ruleLearnerService";

interface BootstrapOptions {
  force?: boolean;
  minFlowCount?: number;
  maxCandidates?: number;
}

interface BootstrapResult {
  created: number;
  attempted: number;
  skippedReason?: string;
}

interface CandidateFlow {
  flow: Flow;
  supportCount: number;
  reason: string;
}

/**
 * 初始规则生成服务
 * - 当用户没有规则但已有足够流水时，根据高频交易方自动调用学习引擎生成首批规则
 */
export class RuleBootstrapService {
  private static readonly MIN_TOTAL_FLOWS = 40;
  private static readonly MIN_MERCHANT_OCCURRENCE = 4;
  private static readonly MAX_CANDIDATES = 100; // 增加候选流水数量，支持更多规则生成
  private static readonly MAX_RULES_PER_BOOK = 50; // 增加每个账本的最大规则数，从5增加到50

  /**
   * 确保当前用户拥有初始规则（若已有规则则跳过）
   */
  static async ensureInitialRules(
    userId: number,
    options?: BootstrapOptions
  ): Promise<BootstrapResult> {
    const force = options?.force === true;
    const minFlowCount = options?.minFlowCount ?? this.MIN_TOTAL_FLOWS;
    const maxCandidates = options?.maxCandidates ?? this.MAX_CANDIDATES;

    const existingRuleCount = await prisma.flowMatchingRule.count({
      where: { userId },
    });

    if (existingRuleCount > 0 && !force) {
      return {
        created: 0,
        attempted: 0,
        skippedReason: "rules-exist",
      };
    }

    const totalFlowCount = await prisma.flow.count({
      where: { userId },
    });

    if (totalFlowCount < minFlowCount) {
      return {
        created: 0,
        attempted: 0,
        skippedReason: "insufficient-flows",
      };
    }

    // 根据总流水数量动态调整每个账本的最大规则数
    // 流水越多，允许每个账本生成更多规则
    let maxRulesPerBook = this.MAX_RULES_PER_BOOK;
    if (totalFlowCount >= 10000) {
      maxRulesPerBook = 100; // 1万条以上：每个账本最多100条规则
    } else if (totalFlowCount >= 5000) {
      maxRulesPerBook = 75; // 5千条以上：每个账本最多75条规则
    } else if (totalFlowCount >= 1000) {
      maxRulesPerBook = 50; // 1千条以上：每个账本最多50条规则
    }

    const candidates = await this.collectCandidateFlows(userId, maxCandidates, maxRulesPerBook);

    if (candidates.length === 0) {
      return {
        created: 0,
        attempted: 0,
        skippedReason: "no-candidates",
      };
    }

    let created = 0;
    let attempted = 0;

    for (const candidate of candidates) {
      attempted++;
      try {
        const sampleFlow = this.mapDbFlowToParsed(candidate.flow);
        const result = await RuleLearnerService.learn({
          flow: sampleFlow,
          targetBookId: candidate.flow.bookId,
          targetCategory: candidate.flow.industryType || undefined,
          targetFlowType: candidate.flow.flowType || undefined,
          userId,
        });

        if (result.success) {
          created++;
          console.log(
            `[RuleBootstrap] 创建规则: ${result.ruleType} (book: ${candidate.flow.bookId}, merchant: ${candidate.flow.name || "N/A"}, support: ${candidate.supportCount})`
          );
        }
      } catch (err: any) {
        console.warn(
          "[RuleBootstrap] 生成规则失败:",
          err?.message || String(err)
        );
      }
    }

    return { created, attempted };
  }

  /**
   * 收集潜在的候选流水，优先高频交易方
   */
  private static async collectCandidateFlows(
    userId: number,
    limit: number,
    maxRulesPerBook: number = this.MAX_RULES_PER_BOOK
  ): Promise<CandidateFlow[]> {
    const groups = await prisma.flow.groupBy({
      by: ["bookId", "name", "industryType"],
      where: {
        userId,
        name: { not: null },
        industryType: { not: null },
      },
      _count: { _all: true },
    });

    // Sort by count descending (since _all is not valid in orderBy for groupBy)
    const sortedGroups = groups.sort((a, b) => {
      const countA = a._count?._all ?? 0;
      const countB = b._count?._all ?? 0;
      return countB - countA;
    }).slice(0, limit * 3);

    const perBookCounter = new Map<string, number>();
    const candidates: CandidateFlow[] = [];

    for (const group of sortedGroups) {
      const merchantName = (group.name || "").trim();
      const category = (group.industryType || "").trim();
      const support = group._count?._all ?? 0;

      if (
        merchantName.length === 0 ||
        category.length === 0 ||
        support < this.MIN_MERCHANT_OCCURRENCE
      ) {
        continue;
      }

      const bookUsage = perBookCounter.get(group.bookId) ?? 0;
      if (bookUsage >= maxRulesPerBook) {
        continue;
      }

      const sampleFlow = await prisma.flow.findFirst({
        where: {
          userId,
          bookId: group.bookId,
          name: group.name,
          industryType: group.industryType,
        },
        orderBy: {
          id: "desc",
        },
      });

      if (!sampleFlow || !sampleFlow.money || sampleFlow.money <= 0) {
        continue;
      }

      perBookCounter.set(group.bookId, bookUsage + 1);
      candidates.push({
        flow: sampleFlow,
        supportCount: support,
        reason: "merchant-frequency",
      });

      if (candidates.length >= limit) {
        break;
      }
    }

    return candidates;
  }

  private static mapDbFlowToParsed(flow: Flow): ParsedFlow {
    return {
      day: flow.day || new Date().toISOString().slice(0, 10),
      flowType: flow.flowType || (flow.money && flow.money >= 0 ? "支出" : "收入"),
      industryType: flow.industryType || undefined,
      payType: flow.payType || undefined,
      money: Math.abs(flow.money || 0),
      name: flow.name || undefined,
      description: flow.description || undefined,
      attribution: flow.attribution || undefined,
    };
  }
}

