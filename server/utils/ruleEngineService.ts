// import prisma from "~/lib/prisma";
import type { ParsedFlow } from "./flowParser";
import { CategoryDictionaryService } from "./categoryDictionaryService";

/**
 * 规则类型枚举
 */
export enum RuleType {
  MERCHANT_KEYWORD = "MERCHANT_KEYWORD", // 按交易方关键词匹配
  DESCRIPTION_KEYWORD = "DESCRIPTION_KEYWORD", // 按备注关键词匹配
  AMOUNT_RANGE = "AMOUNT_RANGE", // 按金额区间匹配
  PAY_TYPE = "PAY_TYPE", // 按支付方式匹配
  COMBINED = "COMBINED", // 多条件组合
}

/**
 * 规则匹配条件接口
 */
export interface RuleConditions {
  // MERCHANT_KEYWORD / DESCRIPTION_KEYWORD
  keywords?: string[];
  
  // AMOUNT_RANGE
  min?: number;
  max?: number;
  
  // PAY_TYPE
  payTypes?: string[];
  
  // COMBINED (可包含以上所有字段)
  merchantKeywords?: string[];
  descriptionKeywords?: string[];
  amountRange?: { min?: number; max?: number };
}

/**
 * 规则匹配结果
 */
export interface RuleMatchResult {
  accountId?: string; // 账本ID（bookId）
  categoryId?: string; // 分类（industryType）
  confidence: number; // 置信度 0-1
  ruleId: number; // 命中的规则ID
  ruleName?: string; // 规则名称
  specificity: number; // 规则特异性评分（条件越多越特异）
}

/**
 * 流水匹配规则引擎服务
 * 
 * 当前使用分类字典（expense_category_dictionary.json）进行关键字匹配
 * 数据库规则匹配功能已暂时注释，如需恢复请取消注释相关代码
 */
export class RuleEngineService {
  /**
   * 匹配流水到规则（使用分类字典关键字匹配）
   * @param flow 标准流水对象
   * @param userId 用户ID（当前未使用，保留以兼容接口）
   * @param candidateBookIds 候选账本ID列表（当前未使用，保留以兼容接口）
   * @returns 匹配结果，如果没有匹配则返回 null
   */
  static async match(
    flow: ParsedFlow,
    userId: number,
    candidateBookIds?: string[]
  ): Promise<RuleMatchResult | null> {
    // ========== 使用分类字典进行关键字匹配 ==========
    try {
      const matchResult = CategoryDictionaryService.matchCategory({
        name: flow.name,
        description: flow.description,
        goods: flow.goods,
        payType: flow.payType,
      });

      if (!matchResult) {
        return null;
      }

      // 返回匹配结果（格式兼容原有的 RuleMatchResult）
      return {
        accountId: undefined, // 字典匹配不提供账本ID，由后续步骤处理
        categoryId: matchResult.category, // 分类名称
        confidence: matchResult.confidence, // 置信度（来自字典匹配）
        ruleId: -1, // 字典匹配没有规则ID，使用 -1 表示
        ruleName: `字典匹配: ${matchResult.matchedPattern} (${matchResult.matchedField})`, // 规则名称：显示匹配的关键词和字段
        specificity: matchResult.confidence * 100, // 使用置信度 * 100 作为特异性评分
      };
    } catch (error: any) {
      console.error(`[RuleEngineService] 分类字典匹配异常:`, error?.message || String(error), error?.stack);
      return null;
    }

    // ========== 数据库规则匹配（已注释） ==========
    // 如需恢复数据库规则匹配，请取消以下代码的注释：
    /*
    // 1. 获取所有启用的规则
    const where: any = {
      userId,
      enabled: true,
    };

    // 如果指定了候选账本，只匹配这些账本的规则
    if (candidateBookIds && candidateBookIds.length > 0) {
      where.targetBookId = { in: candidateBookIds };
    }

    const rules = await prisma.flowMatchingRule.findMany({
      where,
      orderBy: [
        { priority: "desc" }, // 优先级降序
        { hitCount: "desc" }, // 命中次数降序（作为次要排序）
      ],
    });

    if (rules.length === 0) {
      return null;
    }

    // 2. 依次匹配规则
    const matchedRules: Array<{
      rule: typeof rules[0];
      specificity: number;
    }> = [];

    for (const rule of rules) {
      const conditions = JSON.parse(rule.conditions) as RuleConditions;
      const isMatched = this.checkRuleMatch(flow, rule.ruleType, conditions);

      if (isMatched) {
        // 计算规则特异性评分（条件越多越特异）
        const specificity = this.calculateSpecificity(rule.ruleType, conditions);
        matchedRules.push({ rule, specificity });
      }
    }

    if (matchedRules.length === 0) {
      return null;
    }

    // 3. 选择最佳规则（优先级 + 特异性）
    const bestMatch = this.selectBestRule(matchedRules);

    // 4. 更新规则命中次数
    await prisma.flowMatchingRule.update({
      where: { id: bestMatch.rule.id },
      data: { hitCount: { increment: 1 } },
    });

    // 5. 计算置信度
    const confidence = this.calculateConfidence(
      bestMatch.rule,
      bestMatch.specificity
    );

    return {
      accountId: bestMatch.rule.targetBookId,
      categoryId: bestMatch.rule.targetCategory || undefined,
      confidence,
      ruleId: bestMatch.rule.id,
      ruleName: bestMatch.rule.ruleName || undefined,
      specificity: bestMatch.specificity,
    };
    */
  }

  /**
   * 检查规则是否匹配
   */
  private static checkRuleMatch(
    flow: ParsedFlow,
    ruleType: string,
    conditions: RuleConditions
  ): boolean {
    switch (ruleType) {
      case RuleType.MERCHANT_KEYWORD:
        return this.matchMerchantKeywords(flow, conditions);

      case RuleType.DESCRIPTION_KEYWORD:
        return this.matchDescriptionKeywords(flow, conditions);

      case RuleType.AMOUNT_RANGE:
        return this.matchAmountRange(flow, conditions);

      case RuleType.PAY_TYPE:
        return this.matchPayType(flow, conditions);

      case RuleType.COMBINED:
        return this.matchCombined(flow, conditions);

      default:
        return false;
    }
  }

  /**
   * 匹配交易方关键词
   */
  private static matchMerchantKeywords(
    flow: ParsedFlow,
    conditions: RuleConditions
  ): boolean {
    if (!conditions.keywords || conditions.keywords.length === 0) {
      return false;
    }

    const merchantName = (flow.name || "").toLowerCase();
    return conditions.keywords.some((keyword) =>
      merchantName.includes(keyword.toLowerCase())
    );
  }

  /**
   * 匹配备注关键词
   */
  private static matchDescriptionKeywords(
    flow: ParsedFlow,
    conditions: RuleConditions
  ): boolean {
    if (!conditions.keywords || conditions.keywords.length === 0) {
      return false;
    }

    const description = (flow.description || "").toLowerCase();
    return conditions.keywords.some((keyword) =>
      description.includes(keyword.toLowerCase())
    );
  }

  /**
   * 匹配金额区间
   */
  private static matchAmountRange(
    flow: ParsedFlow,
    conditions: RuleConditions
  ): boolean {
    const amount = flow.money || 0;
    const min = conditions.min ?? 0;
    const max = conditions.max ?? Number.MAX_SAFE_INTEGER;

    return amount >= min && amount <= max;
  }

  /**
   * 匹配支付方式
   */
  private static matchPayType(
    flow: ParsedFlow,
    conditions: RuleConditions
  ): boolean {
    if (!conditions.payTypes || conditions.payTypes.length === 0) {
      return false;
    }

    const payType = (flow.payType || "").toLowerCase();
    return conditions.payTypes.some((pt) =>
      payType.includes(pt.toLowerCase())
    );
  }

  /**
   * 匹配组合条件（所有条件都必须满足）
   */
  private static matchCombined(
    flow: ParsedFlow,
    conditions: RuleConditions
  ): boolean {
    let allMatched = true;

    // 交易方关键词
    if (conditions.merchantKeywords && conditions.merchantKeywords.length > 0) {
      const merchantName = (flow.name || "").toLowerCase();
      const matched = conditions.merchantKeywords.some((keyword) =>
        merchantName.includes(keyword.toLowerCase())
      );
      if (!matched) allMatched = false;
    }

    // 备注关键词
    if (
      conditions.descriptionKeywords &&
      conditions.descriptionKeywords.length > 0
    ) {
      const description = (flow.description || "").toLowerCase();
      const matched = conditions.descriptionKeywords.some((keyword) =>
        description.includes(keyword.toLowerCase())
      );
      if (!matched) allMatched = false;
    }

    // 金额区间
    if (conditions.amountRange) {
      const amount = flow.money || 0;
      const min = conditions.amountRange.min ?? 0;
      const max = conditions.amountRange.max ?? Number.MAX_SAFE_INTEGER;
      if (amount < min || amount > max) allMatched = false;
    }

    // 支付方式
    if (conditions.payTypes && conditions.payTypes.length > 0) {
      const payType = (flow.payType || "").toLowerCase();
      const matched = conditions.payTypes.some((pt) =>
        payType.includes(pt.toLowerCase())
      );
      if (!matched) allMatched = false;
    }

    return allMatched;
  }

  /**
   * 计算规则特异性评分（条件越多越特异）
   */
  private static calculateSpecificity(
    ruleType: string,
    conditions: RuleConditions
  ): number {
    let score = 0;

    if (ruleType === RuleType.COMBINED) {
      // 组合规则：每个条件类型 +10 分
      if (conditions.merchantKeywords && conditions.merchantKeywords.length > 0) {
        score += 10;
        score += conditions.merchantKeywords.length; // 关键词数量额外加分
      }
      if (
        conditions.descriptionKeywords &&
        conditions.descriptionKeywords.length > 0
      ) {
        score += 10;
        score += conditions.descriptionKeywords.length;
      }
      if (conditions.amountRange) {
        score += 10;
        // 金额区间越窄，特异性越高
        if (
          conditions.amountRange.min !== undefined &&
          conditions.amountRange.max !== undefined
        ) {
          const range = conditions.amountRange.max - conditions.amountRange.min;
          if (range < 50) score += 5; // 区间小于50元，额外加分
        }
      }
      if (conditions.payTypes && conditions.payTypes.length > 0) {
        score += 10;
      }
    } else {
      // 单条件规则：基础分 + 条件数量
      if (conditions.keywords) {
        score = 10 + conditions.keywords.length;
      } else if (conditions.payTypes) {
        score = 10 + conditions.payTypes.length;
      } else if (conditions.min !== undefined || conditions.max !== undefined) {
        score = 10;
        // 金额区间越窄，特异性越高
        if (conditions.min !== undefined && conditions.max !== undefined) {
          const range = conditions.max - conditions.min;
          if (range < 50) score += 5;
        }
      }
    }

    return score;
  }

  /**
   * 选择最佳规则（优先级 + 特异性）
   */
  private static selectBestRule(
    matchedRules: Array<{ rule: any; specificity: number }>
  ): { rule: any; specificity: number } {
    // 按 priority * 100 + specificity 排序（优先级权重更高）
    matchedRules.sort((a, b) => {
      const scoreA = a.rule.priority * 100 + a.specificity;
      const scoreB = b.rule.priority * 100 + b.specificity;
      return scoreB - scoreA; // 降序
    });

    return matchedRules[0];
  }

  /**
   * 计算置信度
   */
  private static calculateConfidence(
    rule: any,
    specificity: number
  ): number {
    // 基础置信度：根据规则优先级和命中次数
    let confidence = 0.7; // 基础置信度

    // 优先级影响（0-100，越高置信度越高）
    confidence += (rule.priority / 100) * 0.2; // 最多增加 0.2

    // 命中次数影响（命中越多，置信度越高）
    if (rule.hitCount > 0) {
      confidence += Math.min(rule.hitCount / 100, 0.1); // 最多增加 0.1
    }

    // 特异性影响（条件越多，置信度越高）
    confidence += Math.min(specificity / 100, 0.1); // 最多增加 0.1

    // 限制在 0.5 - 0.95 之间
    return Math.max(0.5, Math.min(0.95, confidence));
  }
}

