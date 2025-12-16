import prisma from "~/lib/prisma";

/**
 * 账本画像数据接口
 */
export interface BookProfileData {
  categoryWeights: Record<string, number>; // 分类权重
  merchantKeywords: Record<string, number>; // 高频词词频
  payTypeStats: Record<string, number>; // 支付方式统计
  amountDistribution: Record<string, number>; // 金额分布
  totalFlows: number; // 总流水数
  summary?: string; // 画像摘要
}

/**
 * 金额区间定义
 */
const AMOUNT_RANGES = [
  { label: "0-50", min: 0, max: 50 },
  { label: "50-200", min: 50, max: 200 },
  { label: "200-500", min: 200, max: 500 },
  { label: "500-1000", min: 500, max: 1000 },
  { label: "1000+", min: 1000, max: Number.MAX_SAFE_INTEGER },
];

/**
 * 账本画像服务
 * 负责从历史流水中构建和维护账本画像
 */
export class AccountProfileService {
  /**
   * 对流水文本字段做统一关键词提取（供识别侧复用）
   */
  static extractFlowKeywords(
    textSegments: Array<string | null | undefined>,
    accountStopWords?: Set<string>
  ): string[] {
    const keywordSet = new Set<string>();
    for (const segment of textSegments) {
      if (!segment) continue;
      const keywords = this.extractDescriptionKeywords(segment, accountStopWords);
      for (const k of keywords) {
        keywordSet.add(k);
      }
    }
    return Array.from(keywordSet);
  }

  /**
   * 重建账本画像
   * @param userId 用户ID
   * @param bookId 账本ID
   * @returns 重建后的画像数据
   */
  static async rebuild(userId: number, bookId: string): Promise<BookProfileData> {
    // 1. 获取该账本的所有历史流水（包含账户信息）
    const flows = await prisma.flow.findMany({
      where: {
        userId,
        bookId,
        // 只统计已确认的流水（排除标记为消除的）
        eliminate: 0,
      },
      select: {
        industryType: true,
        name: true,
        description: true,
        payType: true,
        loanType: true,
        counterparty: true,
        origin: true,
        attribution: true,
        money: true,
        accountId: true,
      },
    });

    if (flows.length === 0) {
      // 如果没有流水，返回空画像
      const emptyProfile: BookProfileData = {
        categoryWeights: {},
        merchantKeywords: {},
        payTypeStats: {},
        amountDistribution: {},
        totalFlows: 0,
      };

      // 保存空画像
      await this.saveProfile(userId, bookId, emptyProfile);
      const summary = this.buildProfileSummary(emptyProfile);
      return { ...emptyProfile, summary };
    }

    // 2. 统计分类权重
    const categoryWeights: Record<string, number> = {};
    for (const flow of flows) {
      if (flow.industryType) {
        categoryWeights[flow.industryType] =
          (categoryWeights[flow.industryType] || 0) + 1;
      }
    }

    // 3. 统计关键词（从交易对方、商户/备注、账户名称提取，默认top 30）
    const accountStopWords = this.buildAccountStopWords(flows);
    const merchantKeywords = this.extractTopMerchantKeywords(
      flows,
      30,
      accountStopWords
    );

    // 4. 统计支付方式
    const payTypeStats: Record<string, number> = {};
    for (const flow of flows) {
      if (flow.payType) {
        payTypeStats[flow.payType] = (payTypeStats[flow.payType] || 0) + 1;
      }
    }

    // 5. 统计金额分布
    const amountDistribution: Record<string, number> = {};
    for (const flow of flows) {
      const amount = flow.money || 0;
      const range = this.getAmountRange(amount);
      amountDistribution[range] = (amountDistribution[range] || 0) + 1;
    }

    // 6. 构建画像数据
    const profile: BookProfileData = {
      categoryWeights,
      merchantKeywords,
      payTypeStats,
      amountDistribution,
      totalFlows: flows.length,
    };

    // 7. 保存画像
    await this.saveProfile(userId, bookId, profile);

    const summary = this.buildProfileSummary(profile);

    return { ...profile, summary };
  }

  /**
   * 增量更新账本画像
   * @param userId 用户ID
   * @param bookId 账本ID
   * @param newFlows 新增的流水列表
   */
  static async incrementalUpdate(
    userId: number,
    bookId: string,
    newFlows: Array<{
      industryType?: string | null;
      name?: string | null;
      counterparty?: string | null;
      description?: string | null;
      payType?: string | null;
      loanType?: string | null;
      origin?: string | null;
      attribution?: string | null;
      money?: number | null;
    }>
  ): Promise<void> {
    // 动态账户停用词：基于用户账户名称，避免账户名进入画像
    const accountStopWords = await this.buildAccountStopWordsForUser(userId);

    // 获取现有画像
    const existing = await prisma.bookProfile.findUnique({
      where: {
        userId_bookId: {
          userId,
          bookId,
        },
      },
    });

    if (!existing) {
      // 如果不存在，重建整个画像
      await this.rebuild(userId, bookId);
      return;
    }

    // 解析现有画像数据
    const profile: BookProfileData = {
      categoryWeights: JSON.parse(existing.categoryWeights || "{}"),
      merchantKeywords: JSON.parse(existing.merchantKeywords || "{}"),
      payTypeStats: JSON.parse(existing.payTypeStats || "{}"),
      amountDistribution: JSON.parse(existing.amountDistribution || "{}"),
      totalFlows: existing.totalFlows,
    };

    // 增量更新
    for (const flow of newFlows) {
      // 更新分类权重
      if (flow.industryType) {
        profile.categoryWeights[flow.industryType] =
          (profile.categoryWeights[flow.industryType] || 0) + 1;
      }

      // 更新关键词（从所有文本字段提取）
      const textSegments = [
        flow.name,
        flow.counterparty,
        flow.description,
        flow.loanType,
        flow.origin,
        flow.attribution,
      ];
      for (const segment of textSegments) {
        if (!segment) {
          continue;
        }
        const keywords = this.extractDescriptionKeywords(
          segment,
          accountStopWords
        );
        for (const keyword of keywords) {
          profile.merchantKeywords[keyword] =
            (profile.merchantKeywords[keyword] || 0) + 1;
        }
      }

      // 更新支付方式
      if (flow.payType) {
        profile.payTypeStats[flow.payType] =
          (profile.payTypeStats[flow.payType] || 0) + 1;
      }

      // 更新金额分布
      if (flow.money) {
        const range = this.getAmountRange(flow.money);
        profile.amountDistribution[range] =
          (profile.amountDistribution[range] || 0) + 1;
      }

      profile.totalFlows += 1;
    }

    // 重新提取top N关键词（保持数量限制，提高到30）
    profile.merchantKeywords = this.getTopN(
      profile.merchantKeywords,
      30
    );

    // 保存更新后的画像
    await this.saveProfile(userId, bookId, profile);

    this.buildProfileSummary(profile);
  }

  /**
   * 保存画像到数据库
   */
  private static async saveProfile(
    userId: number,
    bookId: string,
    profile: BookProfileData
  ): Promise<void> {
    await prisma.bookProfile.upsert({
      where: {
        userId_bookId: {
          userId,
          bookId,
        },
      },
      create: {
        userId,
        bookId,
        categoryWeights: JSON.stringify(profile.categoryWeights),
        merchantKeywords: JSON.stringify(profile.merchantKeywords),
        payTypeStats: JSON.stringify(profile.payTypeStats),
        amountDistribution: JSON.stringify(profile.amountDistribution),
        totalFlows: profile.totalFlows,
        lastUpdatedAt: new Date(),
      },
      update: {
        categoryWeights: JSON.stringify(profile.categoryWeights),
        merchantKeywords: JSON.stringify(profile.merchantKeywords),
        payTypeStats: JSON.stringify(profile.payTypeStats),
        amountDistribution: JSON.stringify(profile.amountDistribution),
        totalFlows: profile.totalFlows,
        lastUpdatedAt: new Date(),
      },
    });
  }

  /**
   * 提取top N关键词（从交易对方、商户/备注、账户名称提取）
   */
  private static extractTopMerchantKeywords(
    flows: Array<{
      name?: string | null;
      counterparty?: string | null;
      description?: string | null;
      loanType?: string | null;
      origin?: string | null;
      attribution?: string | null;
    }>,
    topN: number,
    accountStopWords?: Set<string>
  ): Record<string, number> {
    const keywordCounts: Record<string, number> = {};

    for (const flow of flows) {
      const textSegments = [
        flow.name,
        flow.counterparty,
        flow.description,
        flow.loanType,
        flow.origin,
        flow.attribution,
      ];

      for (const segment of textSegments) {
        if (!segment) {
          continue;
        }
        const keywords = this.extractDescriptionKeywords(segment, accountStopWords);
        for (const keyword of keywords) {
          keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
        }
      }
    }

    return this.getTopN(keywordCounts, topN);
  }

  /**
   * 转账/借贷等模板噪声，提取前先剔除
   */
  private static sanitizeTextForKeywords(
    text: string,
    accountStopWords?: Set<string>
  ): string {
    if (!text) return "";

    // 去掉常见转账/借贷/还款模板前缀或词组，保留后面的主体（如银行名）
    const patterns: RegExp[] = [
      /(转账到|转账至|转至|转到|转入|转出)/gi,
      /(从.+?转账)/gi,
      /(借入给|借出给|借给|还款给)/gi,
      /(借入|借出|借贷|借款|还款|花呗|借呗|周周存钱)/gi,
    ];

    let sanitized = text;
    for (const p of patterns) {
      sanitized = sanitized.replace(p, "");
    }

    // 直接剔除整段“转账到XXX”或“从XXX转账”类短语，避免残留主体
    const transferPhrases: RegExp[] = [
      /(转账(到|至)?)[^\s，。；、]{0,30}/gi, // 转账到建设银行储蓄卡…
      /(从)[^\s，。；、]{0,30}(转账)/gi,     // 从建设银行转账…
      /(转出|转入)[^\s，。；、]{0,30}/gi,
    ];
    for (const p of transferPhrases) {
      sanitized = sanitized.replace(p, "");
    }

    // 进一步剔除账户/卡号类描述，避免账户名进入关键词
    const accountNoise: RegExp[] = [
      /[\u4e00-\u9fa5A-Za-z]*银行[^\s，。；、]{0,6}卡/gi, // 招商银行储蓄卡/工商银行信用卡
      /(储蓄卡|信用卡|借记卡|贷记卡)/gi,
      /(尾号|末四位)[0-9Xx]{2,6}/gi,
      /(账号|账户|卡号)[0-9Xx]{4,}/gi,
    ];
    for (const p of accountNoise) {
      sanitized = sanitized.replace(p, "");
    }

    // 动态账户名称停用词（基于用户现有账户）
    if (accountStopWords && accountStopWords.size > 0) {
      for (const name of accountStopWords) {
        if (!name) continue;
        try {
          const escaped = this.escapeRegExp(name.trim());
          if (escaped) {
            sanitized = sanitized.replace(new RegExp(escaped, "gi"), "");
          }
        } catch {
          // ignore invalid regex
        }
      }
    }

    sanitized = sanitized.trim();

    return sanitized;
  }

  private static escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 无意义词汇过滤列表（用于过滤通用词汇）
   */
  private static readonly STOP_WORDS = new Set([
    "支付", "转账", "成功", "已完成", "完成", "收款", "付款", "支出", "收入",
    "订单", "交易", "消费", "充值", "提现", "余额", "账户", "银行", "卡",
    "方式", "渠道", "平台", "系统", "服务", "公司", "有限公司", "股份",
    "的", "了", "是", "在", "有", "和", "与", "及", "或", "等", "等",
  ]);

  /**
   * 从交易对方名称中提取关键词（2-4字）
   */
  private static extractKeywords(
    text: string,
    accountStopWords?: Set<string>
  ): string[] {
    if (!text || text.length === 0) {
      return [];
    }

    text = this.sanitizeTextForKeywords(text, accountStopWords);

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
        // 过滤无意义词汇
        if (
          keyword.length >= 2 &&
          !keywords.includes(keyword) &&
          !this.STOP_WORDS.has(keyword)
        ) {
          keywords.push(keyword);
        }
      }
    }

    return keywords;
  }

  /**
   * 从备注/描述中提取关键词（2-6字，过滤无意义词汇）
   */
  private static extractDescriptionKeywords(
    text: string,
    accountStopWords?: Set<string>
  ): string[] {
    if (!text || text.length === 0) {
      return [];
    }

    text = this.sanitizeTextForKeywords(text, accountStopWords);

    // 清理标点，按空白切分，避免滑动窗口导致大量重叠词
    const cleaned = text
      .replace(/[（）()【】\[\]、，。！？；：,.!?;:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) {
      return [];
    }

    const tokens = cleaned.split(/\s+/);
    const keywordSet: Set<string> = new Set();

    for (const token of tokens) {
      // 提取连续中文片段，最长保留8字（避免账户/备注过长）
      const chineseSegments = token.match(/[\u4e00-\u9fa5]+/g) || [];
      for (const seg of chineseSegments) {
        if (seg.length < 2) continue;
        const clipped = seg.length > 8 ? seg.slice(0, 8) : seg;
        if (!this.STOP_WORDS.has(clipped)) {
          keywordSet.add(clipped);
        }
      }

      // 提取英文与数字片段（长度>=2）
      const latinSegments = token.match(/[A-Za-z0-9]{2,}/g) || [];
      for (const seg of latinSegments) {
        if (!this.STOP_WORDS.has(seg)) {
          keywordSet.add(seg);
        }
      }
    }

    return Array.from(keywordSet);
  }

  /**
   * 从账户名称中提取关键词（2-4字）
   */
  private static extractAccountKeywords(
    text: string,
    accountStopWords?: Set<string>
  ): string[] {
    if (!text || text.length === 0) {
      return [];
    }

    text = this.sanitizeTextForKeywords(text, accountStopWords);

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
        // 过滤无意义词汇，但保留支付平台相关词汇（如"支付宝"、"微信"等）
        if (
          keyword.length >= 2 &&
          !keywords.includes(keyword) &&
          !this.STOP_WORDS.has(keyword)
        ) {
          keywords.push(keyword);
        }
      }
    }

    return keywords;
  }

  /**
   * 获取top N项（按值降序）
   */
  private static getTopN(
    data: Record<string, number>,
    topN: number
  ): Record<string, number> {
    const entries = Object.entries(data);
    entries.sort((a, b) => b[1] - a[1]); // 按值降序
    const topEntries = entries.slice(0, topN);
    return Object.fromEntries(topEntries);
  }

  /**
   * 基于流水中的账户名称，构建动态停用词（过滤账户名进入画像）
   */
  private static buildAccountStopWords(
    flows: Array<{
      account?: { name: string | null } | null;
      name?: string | null;
      counterparty?: string | null;
      description?: string | null;
      loanType?: string | null;
      origin?: string | null;
      attribution?: string | null;
    }>
  ): Set<string> {
    const set = new Set<string>();
    for (const flow of flows) {
      if (flow.account?.name) {
        set.add(flow.account.name.trim());
      }
    }
    return set;
  }

  /**
   * 基于用户所有账户名称构建停用词（用于增量更新场景）
   */
  private static async buildAccountStopWordsForUser(
    userId: number
  ): Promise<Set<string>> {
    const set = new Set<string>();
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { name: true },
    });
    for (const acc of accounts) {
      if (acc.name) {
        set.add(acc.name.trim());
      }
    }
    return set;
  }

  /**
   * 获取用户账户名称停用词（外部可复用）
   */
  static async getAccountStopWordsForUser(
    userId: number
  ): Promise<Set<string>> {
    return this.buildAccountStopWordsForUser(userId);
  }

  /**
   * 获取金额所属的区间
   */
  private static getAmountRange(amount: number): string {
    for (const range of AMOUNT_RANGES) {
      if (amount >= range.min && amount < range.max) {
        return range.label;
      }
    }
    return "1000+"; // 默认返回最大区间
  }

  /**
   * 获取账本画像
   */
  static async getProfile(
    userId: number,
    bookId: string
  ): Promise<BookProfileData | null> {
    const profile = await prisma.bookProfile.findUnique({
      where: {
        userId_bookId: {
          userId,
          bookId,
        },
      },
    });

    if (!profile) {
      return null;
    }

    const result: BookProfileData = {
      categoryWeights: JSON.parse(profile.categoryWeights || "{}"),
      merchantKeywords: JSON.parse(profile.merchantKeywords || "{}"),
      payTypeStats: JSON.parse(profile.payTypeStats || "{}"),
      amountDistribution: JSON.parse(profile.amountDistribution || "{}"),
      totalFlows: profile.totalFlows,
    };

    return {
      ...result,
      summary: this.buildProfileSummary(result),
    };
  }

  /**
   * 导出账本画像关键词（仅关键词相关，便于迁移到新账本）
   */
  static async exportKeywords(
    userId: number,
    bookId: string
  ): Promise<{
    version: number;
    exportedAt: string;
    bookId: string;
    keywords: Record<string, number>;
    totalFlows: number;
    summary: string;
  } | null> {
    const profile = await this.getProfile(userId, bookId);
    if (!profile) {
      return null;
    }
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      bookId,
      keywords: profile.merchantKeywords || {},
      totalFlows: profile.totalFlows || 0,
      summary: profile.summary || this.buildProfileSummary(profile),
    };
  }

  /**
   * 将外部关键词导入/合并到账本画像（其他统计保持不变）
   */
  static async importKeywords(
    userId: number,
    bookId: string,
    keywords: Record<string, number>,
    options?: {
      override?: boolean; // true 覆盖现有关键词；false 合并
      topN?: number;
    }
  ): Promise<BookProfileData> {
    const topN = options?.topN ?? 50;
    const override = options?.override ?? true;

    const existingRecord = await prisma.bookProfile.findUnique({
      where: {
        userId_bookId: {
          userId,
          bookId,
        },
      },
    });

    const baseProfile: BookProfileData = existingRecord
      ? {
          categoryWeights: JSON.parse(existingRecord.categoryWeights || "{}"),
          merchantKeywords: JSON.parse(existingRecord.merchantKeywords || "{}"),
          payTypeStats: JSON.parse(existingRecord.payTypeStats || "{}"),
          amountDistribution: JSON.parse(
            existingRecord.amountDistribution || "{}"
          ),
          totalFlows: existingRecord.totalFlows || 0,
        }
      : {
          categoryWeights: {},
          merchantKeywords: {},
          payTypeStats: {},
          amountDistribution: {},
          totalFlows: 0,
        };

    const sanitizedKeywords: Record<string, number> = {};
    for (const [word, count] of Object.entries(keywords || {})) {
      const trimmed = word.trim();
      const numeric = Number(count) || 0;
      if (!trimmed || numeric <= 0) continue;
      sanitizedKeywords[trimmed] = numeric;
    }

    if (Object.keys(sanitizedKeywords).length === 0) {
      throw new Error("缺少有效的关键词数据");
    }

    // 合并或覆盖关键词
    const mergedKeywords = override
      ? sanitizedKeywords
      : (() => {
          const merged: Record<string, number> = {
            ...baseProfile.merchantKeywords,
          };
          for (const [k, v] of Object.entries(sanitizedKeywords)) {
            merged[k] = (merged[k] || 0) + v;
          }
          return merged;
        })();

    // 截断到 topN，避免写入过大
    const trimmedKeywords = this.getTopN(mergedKeywords, topN);

    // totalFlows 兜底：保证 >0，避免识别时跳过
    const keywordTotal = Object.values(trimmedKeywords).reduce(
      (sum, v) => sum + (v || 0),
      0
    );
    const totalFlows = Math.max(baseProfile.totalFlows || 0, keywordTotal, 1);

    const newProfile: BookProfileData = {
      ...baseProfile,
      merchantKeywords: trimmedKeywords,
      totalFlows,
    };

    await this.saveProfile(userId, bookId, newProfile);

    return {
      ...newProfile,
      summary: this.buildProfileSummary(newProfile),
    };
  }

  static buildProfileSummary(profile: BookProfileData): string {
    if (!profile.totalFlows || profile.totalFlows === 0) {
      return "暂无流水数据，已初始化账本画像";
    }

    const keywordEntries = Object.entries(profile.merchantKeywords || {});
    if (!keywordEntries.length) {
      return `总流水: ${profile.totalFlows} | 暂无可用词频画像`;
    }

    keywordEntries.sort((a, b) => b[1] - a[1]);
    const maxCount = Math.max(...keywordEntries.map(([, count]) => count));

    const limit = Math.min(20, Math.max(10, keywordEntries.length));
    const topKeywords = keywordEntries.slice(0, limit);
    const keywordSummary = topKeywords
      .map(([word, count]) => `${word}${count ? `(${count})` : ""}`)
      .join("、");

    const diversityNote =
      keywordEntries.length > limit
        ? "，更多词已省略"
        : keywordEntries.length < 10
          ? "，词频样本较少"
          : "";

    return `总流水: ${profile.totalFlows} | 高频词画像: ${keywordSummary}${diversityNote}${
      maxCount ? `（最高频 ${maxCount} 次）` : ""
    }`;
  }

  private static getTopEntry(data: Record<string, number>): string | null {
    const entries = Object.entries(data || {});
    if (!entries.length) {
      return null;
    }
    entries.sort((a, b) => b[1] - a[1]);
    const [label, count] = entries[0];
    return `${label}${count ? `(${count})` : ""}`;
  }
}


