import prisma from "~/lib/prisma";
import { RuleEngineService, RuleType } from "./ruleEngineService";
import type { ParsedFlow } from "./flowParser";

/**
 * 学习请求参数
 */
export interface LearnRequest {
  flow: ParsedFlow; // 原始流水字段
  targetBookId: string; // 新的账本ID
  targetCategory?: string; // 新的分类（industryType）
  targetFlowType?: string; // 新的流水类型
  userId: number; // 用户ID
}

/**
 * 学习结果
 */
export interface LearnResult {
  success: boolean;
  ruleId?: number; // 生成的规则ID
  ruleType: string; // 生成的规则类型
  message: string;
}

/**
 * 规则学习器服务
 * 从用户手动修改中学习并生成新规则
 */
export class RuleLearnerService {
  /**
   * 学习并生成规则
   * @param request 学习请求
   * @returns 学习结果
   */
  static async learn(request: LearnRequest): Promise<LearnResult> {
    const { flow, targetBookId, targetCategory, targetFlowType, userId } =
      request;

    // 1. 检查是否已存在相同或相似的规则
    const existingRule = await this.findSimilarRule(
      flow,
      targetBookId,
      userId
    );
    if (existingRule) {
      // 如果已存在相似规则，提高其优先级
      await prisma.flowMatchingRule.update({
        where: { id: existingRule.id },
        data: {
          priority: { increment: 5 }, // 提高优先级
          hitCount: { increment: 1 },
        },
      });

      return {
        success: true,
        ruleId: existingRule.id,
        ruleType: existingRule.ruleType,
        message: `已存在相似规则，已提高其优先级`,
      };
    }

    // 2. 分析流水特征，决定规则类型和条件
    const ruleStrategy = await this.analyzeFlowPattern(flow, userId);

    // 3. 生成规则
    const rule = await prisma.flowMatchingRule.create({
      data: {
        userId,
        ruleName: ruleStrategy.ruleName,
        ruleType: ruleStrategy.ruleType,
        conditions: JSON.stringify(ruleStrategy.conditions),
        targetBookId,
        targetCategory: targetCategory || null,
        targetFlowType: targetFlowType || null,
        priority: ruleStrategy.priority,
        enabled: true,
        hitCount: 1, // 初始命中次数为1（因为这次修改就是一次命中）
        createdBy: userId,
        source: "LEARNED",
      },
    });

    return {
      success: true,
      ruleId: rule.id,
      ruleType: rule.ruleType,
      message: `已生成新规则：${ruleStrategy.ruleName}`,
    };
  }

  /**
   * 分析流水特征，决定规则策略
   */
  private static async analyzeFlowPattern(
    flow: ParsedFlow,
    userId: number
  ): Promise<{
    ruleType: string;
    conditions: any;
    ruleName: string;
    priority: number;
  }> {
    const merchantName = (flow.name || "").trim();
    const description = (flow.description || "").trim();
    const amount = flow.money || 0;
    const payType = flow.payType || "";

    // 策略1：检查交易方是否稳定（重复3次以上）
    const merchantStability = await this.checkMerchantStability(
      merchantName,
      userId
    );

    if (merchantStability.count >= 3 && merchantName.length > 0) {
      // 交易方稳定，生成交易方关键词规则
      return {
        ruleType: RuleType.MERCHANT_KEYWORD,
        conditions: {
          keywords: [merchantName],
        },
        ruleName: `交易方：${merchantName}`,
        priority: 60, // 中等优先级
      };
    }

    // 策略2：检查备注中是否有稳定关键词
    if (description.length > 0) {
      const descriptionKeywords = this.extractKeywords(description);
      if (descriptionKeywords.length > 0) {
        // 检查这些关键词是否在其他流水中也出现过
        const keywordStability = await this.checkKeywordStability(
          descriptionKeywords,
          userId
        );

        if (keywordStability.length > 0) {
          // 使用最稳定的关键词
          const stableKeywords = keywordStability
            .sort((a, b) => b.count - a.count)
            .slice(0, 3) // 最多使用3个关键词
            .map((k) => k.keyword);

          return {
            ruleType: RuleType.DESCRIPTION_KEYWORD,
            conditions: {
              keywords: stableKeywords,
            },
            ruleName: `备注关键词：${stableKeywords.join("、")}`,
            priority: 55,
          };
        }
      }
    }

    // 策略3：金额区间规则（如果金额在常见范围内）
    if (amount > 0 && amount < 1000) {
      // 生成一个合理的金额区间（±20%）
      const min = Math.max(0, Math.floor(amount * 0.8));
      const max = Math.ceil(amount * 1.2);

      return {
        ruleType: RuleType.AMOUNT_RANGE,
        conditions: {
          min,
          max,
        },
        ruleName: `金额区间：${min}-${max}元`,
        priority: 50, // 金额区间规则优先级较低
      };
    }

    // 策略4：支付方式规则
    if (payType.length > 0) {
      return {
        ruleType: RuleType.PAY_TYPE,
        conditions: {
          payTypes: [payType],
        },
        ruleName: `支付方式：${payType}`,
        priority: 45, // 支付方式规则优先级最低
      };
    }

    // 策略5：组合规则（如果多个条件都有值）
    const combinedConditions: any = {};
    let conditionCount = 0;

    if (merchantName.length > 0) {
      combinedConditions.merchantKeywords = [merchantName];
      conditionCount++;
    }

    if (description.length > 0) {
      const keywords = this.extractKeywords(description);
      if (keywords.length > 0) {
        combinedConditions.descriptionKeywords = keywords.slice(0, 2); // 最多2个关键词
        conditionCount++;
      }
    }

    if (amount > 0 && amount < 1000) {
      combinedConditions.amountRange = {
        min: Math.max(0, Math.floor(amount * 0.8)),
        max: Math.ceil(amount * 1.2),
      };
      conditionCount++;
    }

    if (payType.length > 0) {
      combinedConditions.payTypes = [payType];
      conditionCount++;
    }

    if (conditionCount >= 2) {
      // 至少2个条件，生成组合规则
      return {
        ruleType: RuleType.COMBINED,
        conditions: combinedConditions,
        ruleName: `组合规则（${conditionCount}个条件）`,
        priority: 70 + conditionCount * 5, // 条件越多，优先级越高
      };
    }

    // 默认：如果以上都不满足，生成交易方关键词规则（即使不稳定）
    return {
      ruleType: RuleType.MERCHANT_KEYWORD,
      conditions: {
        keywords: merchantName.length > 0 ? [merchantName] : [],
      },
      ruleName: `交易方：${merchantName || "未知"}`,
      priority: 40, // 低优先级
    };
  }

  /**
   * 检查交易方稳定性（在历史流水中出现的次数）
   */
  private static async checkMerchantStability(
    merchantName: string,
    userId: number
  ): Promise<{ count: number }> {
    if (!merchantName || merchantName.length === 0) {
      return { count: 0 };
    }

    const count = await prisma.flow.count({
      where: {
        userId,
        name: {
          contains: merchantName,
        },
      },
    });

    return { count };
  }

  /**
   * 检查关键词稳定性
   */
  private static async checkKeywordStability(
    keywords: string[],
    userId: number
  ): Promise<Array<{ keyword: string; count: number }>> {
    const results: Array<{ keyword: string; count: number }> = [];

    for (const keyword of keywords) {
      if (keyword.length < 2) continue; // 关键词至少2个字符

      const count = await prisma.flow.count({
        where: {
          userId,
          description: {
            contains: keyword,
          },
        },
      });

      if (count >= 2) {
        // 至少出现2次才认为稳定
        results.push({ keyword, count });
      }
    }

    return results;
  }

  /**
   * 从文本中提取关键词
   */
  private static extractKeywords(text: string): string[] {
    if (!text || text.length === 0) {
      return [];
    }

    // 移除常见无意义字符
    const cleaned = text
      .replace(/[（()）【】\[\]【】]/g, "")
      .replace(/\s+/g, "")
      .trim();

    if (cleaned.length === 0) {
      return [];
    }

    const keywords: string[] = [];

    // 提取2-4字的关键词
    for (let len = 4; len >= 2; len--) {
      for (let i = 0; i <= cleaned.length - len; i++) {
        const keyword = cleaned.substring(i, i + len);
        if (keyword.length >= 2 && !keywords.includes(keyword)) {
          keywords.push(keyword);
        }
      }
    }

    // 返回前5个关键词
    return keywords.slice(0, 5);
  }

  /**
   * 查找相似规则
   */
  private static async findSimilarRule(
    flow: ParsedFlow,
    targetBookId: string,
    userId: number
  ): Promise<any | null> {
    // 查找目标账本相同、且条件相似的规则
    const rules = await prisma.flowMatchingRule.findMany({
      where: {
        userId,
        targetBookId,
        enabled: true,
      },
    });

    // 使用规则引擎检查是否有规则能匹配当前流水
    // 直接调用 match 方法，如果匹配成功说明规则相似
    const matchResult = await RuleEngineService.match(flow, userId, [
      targetBookId,
    ]);

    if (matchResult) {
      // 找到匹配的规则
      return rules.find((r) => r.id === matchResult.ruleId) || null;
    }

    return null;
  }
}

