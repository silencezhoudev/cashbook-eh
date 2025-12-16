import * as fs from "fs";
import * as path from "path";

/**
 * 分类字典条目
 */
export interface CategoryDictionaryEntry {
  patterns: string[]; // 关键词列表
  trade_type_signals?: string[]; // 交易类型信号（可选）
}

/**
 * 分类字典（键：分类名称，值：匹配条件）
 */
export type CategoryDictionary = Record<string, CategoryDictionaryEntry>;

/**
 * 匹配结果
 */
export interface CategoryMatchResult {
  category: string; // 分类名称（如 "交通/打车"）
  matchedPattern: string; // 匹配到的关键词（patterns 中的关键词）
  confidence: number; // 置信度 0-1
  matchedField: "name" | "description" | "goods"; // 匹配到的字段（name=交易对方, description=备注, goods=商品）
}

/**
 * 分类字典服务
 * 用于加载和解析 expense_category_dictionary.json，并提供关键字匹配功能
 */
export class CategoryDictionaryService {
  private static dictionary: CategoryDictionary | null = null;
  private static dictionaryPath: string | null = null;

  /**
   * 初始化字典（加载 JSON 文件）
   */
  static initialize(): void {
    if (this.dictionary !== null) {
      return; // 已经初始化过了
    }

    try {
      // 尝试多个可能的路径
      // 注意：在 Nuxt/Nitro 中，避免使用 __dirname（可能导致 segfault）
      const possiblePaths: string[] = [];
      
      // 安全地获取当前文件所在目录
      try {
        if (typeof __dirname !== 'undefined') {
          possiblePaths.push(
            path.join(__dirname, "..", "..", "expense_category_dictionary.json")
          );
        }
      } catch (e) {
        // __dirname 不可用时跳过
      }

      // 相对于项目根目录的路径
      const cwd = process.cwd();
      possiblePaths.push(
        path.join(cwd, "expense_category_dictionary.json"),
        path.join(cwd, "cashbook", "expense_category_dictionary.json")
      );
      
      let dictionaryPath: string | null = null;
      for (const testPath of possiblePaths) {
        try {
          if (fs.existsSync(testPath)) {
            dictionaryPath = testPath;
            break;
          }
        } catch (e) {
          // 跳过无法访问的路径
          continue;
        }
      }

      if (!dictionaryPath) {
        console.warn(
          `[CategoryDictionary] 字典文件不存在，当前工作目录: ${cwd}`
        );
        this.dictionary = {};
        return;
      }

      // 安全地读取文件
      const fileContent = fs.readFileSync(dictionaryPath, "utf-8");
      this.dictionary = JSON.parse(fileContent) as CategoryDictionary;
      this.dictionaryPath = dictionaryPath;

      const categoryCount = Object.keys(this.dictionary).length;
      console.log(
        `[CategoryDictionary] 成功加载分类字典，共 ${categoryCount} 个分类`
      );
    } catch (error: any) {
      console.error(
        `[CategoryDictionary] 加载字典失败:`,
        error?.message || String(error)
      );
      this.dictionary = {};
    }
  }

  /**
   * 重新加载字典（用于热更新）
   */
  static reload(): void {
    this.dictionary = null;
    this.initialize();
  }

  /**
   * 获取字典内容
   */
  static getDictionary(): CategoryDictionary {
    if (this.dictionary === null) {
      this.initialize();
    }
    return this.dictionary || {};
  }

  /**
   * 匹配分类（基于关键字）
   * 方案C：patterns 匹配即可，如果 trade_type_signals 也匹配 payType 则提高置信度
   * 
   * @param flow 流水对象
   * @returns 匹配结果，如果没有匹配则返回 null
   */
  static matchCategory(flow: {
    name?: string; // 交易对方
    description?: string; // 备注
    goods?: string; // 商品信息
    payType?: string; // 支付方式
  }): CategoryMatchResult | null {
    const dictionary = this.getDictionary();
    if (Object.keys(dictionary).length === 0) {
      return null;
    }

    // 收集所有待匹配的文本字段（转小写，便于匹配）
    // 主要匹配字段：交易对方（name）、备注（description）、商品（goods）
    const textsToMatch: Array<{
      text: string;
      field: "name" | "description" | "goods";
    }> = [];

    if (flow.name) {
      textsToMatch.push({ text: flow.name.toLowerCase(), field: "name" });
    }
    if (flow.description) {
      textsToMatch.push({
        text: flow.description.toLowerCase(),
        field: "description",
      });
    }
    if (flow.goods) {
      textsToMatch.push({ text: flow.goods.toLowerCase(), field: "goods" });
    }

    if (textsToMatch.length === 0) {
      return null;
    }

    // 将 payType 转为小写，用于匹配 trade_type_signals
    const payTypeLower = flow.payType?.toLowerCase() || "";

    // 遍历所有分类，查找匹配
    const matchedResults: CategoryMatchResult[] = [];

    for (const [category, entry] of Object.entries(dictionary)) {
      if (!entry.patterns || entry.patterns.length === 0) {
        continue;
      }

      let patternMatched = false;
      let matchedPattern = "";
      let matchedField: "name" | "description" | "goods" = "name";
      let baseConfidence = 0.7;

      // 第一步：检查 patterns 是否匹配（必须匹配）
      // 优先匹配长关键词（长度 >= 2），单字关键词作为备选
      const patternsSorted = [...entry.patterns].sort((a, b) => b.length - a.length);
      
      for (const pattern of patternsSorted) {
        const patternLower = pattern.toLowerCase();
        const patternLength = patternLower.length;

        // 对于单字关键词（长度为1），使用更严格的匹配规则
        // 要求该字作为独立词出现（前后是词边界或分隔符）
        const isSingleChar = patternLength === 1;
        
        // 检查每个文本字段（交易对方、备注、商品）是否包含该关键词
        for (const { text, field } of textsToMatch) {
          let isMatched = false;
          
          if (isSingleChar) {
            // 单字关键词：要求作为独立词出现（词边界匹配）
            // 匹配规则：字前后是字符串边界、空格、标点符号或其他非中文字符
            // 这样可以避免"家庭"中的"家"被匹配，但"家 "或"家用品"（空格分隔）可以匹配
            // 使用正则表达式：匹配前后不是中文字符的位置
            // 转义特殊字符（如果关键词包含正则特殊字符）
            const escapedPattern = patternLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const wordBoundaryPattern = new RegExp(
              `(^|[^\\u4e00-\\u9fa5])${escapedPattern}([^\\u4e00-\\u9fa5]|$)`
            );
            isMatched = wordBoundaryPattern.test(text);
          } else {
            // 多字关键词：使用简单的包含匹配
            isMatched = text.includes(patternLower);
          }

          if (isMatched) {
            patternMatched = true;
            matchedPattern = pattern;
            matchedField = field;

            // 计算基础置信度：关键词长度 / 文本长度，范围在 0.7-0.95 之间
            const textLength = text.length;
            
            if (isSingleChar) {
              // 单字关键词：大幅降低置信度（0.55-0.65），避免误判
              // 即使匹配成功，置信度也要低于多字关键词
              baseConfidence = Math.min(0.65, Math.max(0.55, 0.6));
            } else {
              // 多字关键词：使用原有逻辑
              baseConfidence = Math.min(
                0.95,
                Math.max(0.7, patternLength / Math.max(textLength, patternLength))
              );

              // 如果关键词长度 >= 4，置信度提高
              if (patternLength >= 4) {
                baseConfidence = Math.min(0.95, baseConfidence + 0.1);
              }
            }

            // patterns 匹配成功，不再检查该分类的其他关键词
            break;
          }
        }

        // 如果已经匹配到 patterns，不再检查其他关键词
        if (patternMatched) {
          break;
        }
      }

      // 如果 patterns 没有匹配，跳过该分类
      if (!patternMatched) {
        continue;
      }

      // 第二步：检查 trade_type_signals 是否匹配 payType（加分项）
      let tradeTypeMatched = false;
      let finalConfidence = baseConfidence;

      if (entry.trade_type_signals && entry.trade_type_signals.length > 0 && payTypeLower) {
        // 检查 payType 是否包含 trade_type_signals 中的任意一个
        for (const signal of entry.trade_type_signals) {
          const signalLower = signal.toLowerCase();
          if (payTypeLower.includes(signalLower)) {
            tradeTypeMatched = true;
            // 如果 trade_type_signals 也匹配，提高置信度（最多提高到 0.98）
            finalConfidence = Math.min(0.98, baseConfidence + 0.15);
            break;
          }
        }
      }

      matchedResults.push({
        category,
        matchedPattern,
        confidence: finalConfidence,
        matchedField,
      });
    }

    if (matchedResults.length === 0) {
      return null;
    }

    // 如果多个分类都匹配到了，选择置信度最高的
    matchedResults.sort((a, b) => b.confidence - a.confidence);
    return matchedResults[0];
  }

  /**
   * 获取所有分类列表
   */
  static getAllCategories(): string[] {
    const dictionary = this.getDictionary();
    return Object.keys(dictionary);
  }

  /**
   * 获取指定分类的关键词列表
   */
  static getCategoryPatterns(category: string): string[] {
    const dictionary = this.getDictionary();
    return dictionary[category]?.patterns || [];
  }
}

