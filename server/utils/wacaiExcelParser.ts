/**
 * 挖财Excel解析服务
 * 专门解析挖财记账导出格式的Excel文件
 */
export class WacaiExcelParser {
  /**
   * 动态导入 xlsx 库
   * 使用动态导入避免 ESM 模块解析问题
   */
  private static async loadXLSX() {
    try {
      const XLSX = await import('xlsx');
      return XLSX;
    } catch (error) {
      console.error('加载 xlsx 库失败:', error);
      throw new Error('无法加载 Excel 解析库');
    }
  }

  /**
   * 解析挖财Excel文件
   */
  static async parseExcelFile(buffer: ArrayBuffer): Promise<{
    headers: string[];
    data: any[];
    metadata: {
      bookName: string;
      totalCount: number;
      dateRange: { start: string; end: string };
    };
    rawBuffer: ArrayBuffer;
  }> {
    try {
      console.log('开始解析Excel文件...');
      console.log('文件大小:', buffer.byteLength, 'bytes');
      
      // 验证buffer
      if (!buffer || buffer.byteLength === 0) {
        throw new Error('文件缓冲区为空');
      }
      
      // 检查文件头验证是否为有效的 Excel 文件
      const uint8Array = new Uint8Array(buffer);
      const fileSignature = Array.from(uint8Array.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
      console.log('文件签名:', fileSignature);
      
      // Excel文件签名检查
      if (!fileSignature.startsWith('504b0304') && !fileSignature.startsWith('504b0506')) {
        console.warn('警告: 文件可能不是有效的Excel文件');
      }
      
      // 动态加载 xlsx 库
      console.log('开始加载XLSX库...');
      const XLSX = await this.loadXLSX();
      
      // 读取Excel文件
      console.log('开始使用XLSX库解析...');
      const workbook = XLSX.read(buffer, { 
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false,
        raw: false
      });
      
      console.log('Excel工作簿读取完成，工作表数量:', workbook.SheetNames.length);
      console.log('工作表名称:', workbook.SheetNames);
      
      if (workbook.SheetNames.length === 0) {
        throw new Error('Excel文件中没有工作表');
      }
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      console.log('使用工作表:', sheetName);
      
      if (!worksheet) {
        throw new Error('无法读取工作表数据');
      }
      
      // 转换为JSON格式
      console.log('开始转换工作表为JSON...');
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: '',
        raw: false,
        blankrows: false
      });
      
      console.log('Excel转换为JSON完成，总行数:', jsonData.length);
      
      if (jsonData.length < 2) {
        throw new Error('Excel文件格式错误：缺少表头或数据');
      }
      
      // 提取表头
      const headers = jsonData[0] as string[];
      console.log('表头字段:', headers);
      
      // 提取数据行（跳过表头）
      const dataRows = jsonData.slice(1);
      console.log('数据行数:', dataRows.length);
      
      // 解析元数据
      const metadata = this.extractMetadata(dataRows);
      console.log('元数据解析完成:', metadata);
      
      return {
        headers,
        data: dataRows,
        metadata,
        rawBuffer: buffer
      };
      
    } catch (error) {
      console.error('Excel文件解析失败:', error);
      console.error('错误详情:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'N/A'
      });
      throw new Error(`Excel文件解析失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 解析单行流水数据
   */
  static parseFlowRow(row: any[], headers: string[]): FlowData {
    const flowData: FlowData = {};
    
    // 创建字段映射
    const fieldMap = this.createFieldMap(headers);
    
    // 日期时间处理
    if (fieldMap.dateTime !== -1 && row[fieldMap.dateTime]) {
      flowData.day = this.parseDate(row[fieldMap.dateTime]);
    }
    
    // 类型处理（收入/支出）
    if (fieldMap.type !== -1 && row[fieldMap.type]) {
      flowData.flowType = this.parseFlowType(row[fieldMap.type]);
    }
    
    // 类别处理
    if (fieldMap.category !== -1 && row[fieldMap.category]) {
      flowData.industryType = String(row[fieldMap.category]).trim();
    }
    
    // 借贷类型处理
    if (fieldMap.type !== -1 && row[fieldMap.type] && fieldMap.category !== -1 && row[fieldMap.category]) {
      const loanInfo = this.parseLoanType(row[fieldMap.type], row[fieldMap.category]);
      if (loanInfo) {
        Object.assign(flowData, loanInfo);
        // 设置显示字段
        flowData.displayFlowType = '借贷';
        flowData.displayIndustryType = loanInfo.loanType;
      }
    }
    
    // 金额处理
    if (fieldMap.amount !== -1 && row[fieldMap.amount]) {
      flowData.money = this.parseAmount(row[fieldMap.amount]);
    }
    
    // 收付账户处理
    if (fieldMap.account !== -1 && row[fieldMap.account]) {
      const accountInfo = this.parseAccountInfo(row[fieldMap.account], flowData.flowType);
      if (accountInfo) {
        Object.assign(flowData, accountInfo);
      }
    }
    
    // 备注处理
    if (fieldMap.remark !== -1 && row[fieldMap.remark]) {
      flowData.description = String(row[fieldMap.remark]).trim();
    }
    
    // 商家处理（作为名称）
    if (fieldMap.merchant !== -1 && row[fieldMap.merchant]) {
      flowData.name = String(row[fieldMap.merchant]).trim();
    }
    
    // 标签处理（合并到备注）
    if (fieldMap.tag !== -1 && row[fieldMap.tag]) {
      const tag = String(row[fieldMap.tag]).trim();
      if (tag && flowData.description) {
        flowData.description = `${flowData.description} #${tag}`;
      } else if (tag) {
        flowData.description = `#${tag}`;
      }
    }
    
    // 借贷对象处理 - 优先从收付账户获取，如果没有再从收付款人获取
    if (flowData.isLoan) {
      // 优先尝试从收付账户字段获取借贷对象信息
      if (fieldMap.account !== -1 && row[fieldMap.account]) {
        const accountStr = String(row[fieldMap.account]).trim();
        // 检查是否包含转账格式（包含冒号和金额）
        if (accountStr.includes(':') || accountStr.includes('：')) {
          // 如果是转账格式，尝试解析借贷对象
          const loanCounterparty = this.parseLoanCounterpartyFromAccount(accountStr);
          if (loanCounterparty) {
            flowData.counterparty = loanCounterparty;
          }
        }
      }
      
      // 如果从收付账户没有获取到借贷对象，再从收付款人字段获取
      if (!flowData.counterparty && fieldMap.payer !== -1 && row[fieldMap.payer]) {
        flowData.counterparty = this.parseCounterparty(row[fieldMap.payer], flowData.description);
      }
    }
    
    return flowData;
  }
  
  /**
   * 创建字段映射
   */
  private static createFieldMap(headers: string[]): FieldMap {
    const map: FieldMap = {
      dateTime: -1,
      type: -1,
      category: -1,
      amount: -1,
      currency: -1,
      account: -1,
      remark: -1,
      merchant: -1,
      tag: -1,
      participant: -1,
      payer: -1,
      attribute: -1
    };
    
    headers.forEach((header, index) => {
      const cleanHeader = String(header).trim();
      
      if (cleanHeader.includes('日期时间') || cleanHeader.includes('时间')) {
        map.dateTime = index;
      } else if (cleanHeader.includes('类型')) {
        map.type = index;
      } else if (cleanHeader.includes('类别')) {
        map.category = index;
      } else if (cleanHeader.includes('金额')) {
        map.amount = index;
      } else if (cleanHeader.includes('币种')) {
        map.currency = index;
      } else if (cleanHeader.includes('收付账户')) {
        map.account = index;
      } else if (cleanHeader.includes('备注')) {
        map.remark = index;
      } else if (cleanHeader.includes('商家')) {
        map.merchant = index;
      } else if (cleanHeader.includes('标签')) {
        map.tag = index;
      } else if (cleanHeader.includes('参与人')) {
        map.participant = index;
      } else if (cleanHeader.includes('收付款人')) {
        map.payer = index;
      } else if (cleanHeader.includes('属性')) {
        map.attribute = index;
      }
    });
    
    return map;
  }
  
  /**
   * 解析日期
   */
  private static parseDate(dateValue: any): string {
    if (!dateValue) return '';
    
    try {
      let date: Date;
      
      if (typeof dateValue === 'number') {
        // Excel日期序列号
        date = new Date((dateValue - 25569) * 86400 * 1000);
      } else if (typeof dateValue === 'string') {
        // 字符串日期
        date = new Date(dateValue);
      } else {
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) {
        throw new Error('无效的日期格式');
      }
      
      // 格式化为 YYYY-MM-DD
      return date.toISOString().split('T')[0];
      
    } catch (error) {
      console.warn('日期解析失败:', dateValue, error);
      return '';
    }
  }
  
  /**
   * 解析流水类型
   */
  private static parseFlowType(typeValue: any): string {
    if (!typeValue) return '';
    
    const type = String(typeValue).trim();
    
    // 挖财的类型映射
    if (type === '支出') return '支出';
    if (type === '收入') return '收入';
    if (type === '转账') return '转账';
    if (type === '借贷') return '借贷';
    
    return type;
  }
  
  /**
   * 解析借贷类型
   */
  private static parseLoanType(typeValue: any, categoryValue: any): any {
    const type = String(typeValue).trim();
    const category = String(categoryValue || '').trim();
    
    if (type === '借贷') {
      if (category === '借入') {
        return {
          isLoan: true,
          loanType: '借入',
          flowType: '借入'
        };
      }
      if (category === '借出') {
        return {
          isLoan: true,
          loanType: '借出',
          flowType: '借出'
        };
      }
      if (category === '收款') {
        return {
          isLoan: true,
          loanType: '收款',
          flowType: '收款'
        };
      }
      if (category === '还款') {
        return {
          isLoan: true,
          loanType: '还款',
          flowType: '还款'
        };
      }
    }
    
    return null;
  }
  
  /**
   * 从收付账户字段解析借贷对象
   */
  private static parseLoanCounterpartyFromAccount(accountStr: string): string | null {
    try {
      console.log('从收付账户解析借贷对象:', accountStr);
      
      // 使用正则表达式匹配账户和金额
      const pattern = /([^：:,]+)[：:]([+-]?\d+\.?\d*)/g;
      const matches = [];
      let match;
      while ((match = pattern.exec(accountStr)) !== null) {
        matches.push(match);
      }
      
      console.log('借贷账户解析匹配结果:', matches);
      
      if (matches.length >= 2) {
        const fromAccountRaw = matches[0][1].trim();
        const toAccountRaw = matches[1][1].trim().replace(/^[，,、\s]+/, '');
        
        // 清理账户名称
        const fromAccount = this.cleanAccountName(fromAccountRaw);
        const toAccount = this.cleanAccountName(toAccountRaw);
        
        console.log('借贷账户解析结果:', {
          fromAccount,
          toAccount
        });
        
        // 判断哪个是借贷对象账户（通常包含"借贷"、"朋友"等关键词）
        if (fromAccount.includes('借贷') || fromAccount.includes('朋友') || fromAccount.includes('宝哥') || fromAccount.includes('蚂蚁借呗')) {
          return this.extractCounterpartyFromAccountName(fromAccount);
        } else if (toAccount.includes('借贷') || toAccount.includes('朋友') || toAccount.includes('宝哥') || toAccount.includes('蚂蚁借呗')) {
          return this.extractCounterpartyFromAccountName(toAccount);
        }
        
        // 如果都不包含关键词，尝试从账户名称中提取
        const counterparty1 = this.extractCounterpartyFromAccountName(fromAccount);
        const counterparty2 = this.extractCounterpartyFromAccountName(toAccount);
        
        // 返回非"未知"的结果
        if (counterparty1 !== '未知') return counterparty1;
        if (counterparty2 !== '未知') return counterparty2;
      }
      
      return null;
    } catch (error) {
      console.warn('从收付账户解析借贷对象出错:', accountStr, error);
      return null;
    }
  }
  
  /**
   * 从账户名称中提取借贷对象
   */
  private static extractCounterpartyFromAccountName(accountName: string): string {
    const name = accountName.toLowerCase();
    
    // 从账户名称中提取借贷对象
    if (name.includes('朋友')) return '朋友';
    if (name.includes('宝哥')) return '宝哥';
    if (name.includes('蚂蚁借呗')) return '蚂蚁借呗';
    if (name.includes('马丹')) return '马丹';
    if (name.includes('表哥')) return '表哥';
    if (name.includes('丽媛')) return '丽媛';
    if (name.includes('江山')) return '江山';
    
    // 如果账户名称包含"借贷-"前缀，提取后面的部分
    if (name.includes('借贷-')) {
      const parts = name.split('借贷-');
      if (parts.length > 1) {
        return parts[1].trim();
      }
    }
    
    return '未知';
  }

  /**
   * 解析借贷对象
   */
  private static parseCounterparty(payerValue: any, remarkValue?: any): string {
    const payer = String(payerValue || '').trim();
    const remark = String(remarkValue || '').trim();
    
    // 从收付款人字段提取
    if (payer.includes('朋友')) return '朋友';
    if (payer.includes('宝哥')) return '宝哥';
    if (payer.includes('蚂蚁借呗')) return '蚂蚁借呗';
    
    // 从备注中提取
    if (remark.includes('马丹')) return '马丹';
    if (remark.includes('表哥')) return '表哥';
    if (remark.includes('丽媛')) return '丽媛';
    if (remark.includes('江山')) return '江山';
    
    return '未知';
  }
  
  /**
   * 解析金额
   */
  private static parseAmount(amountValue: any): number {
    if (!amountValue) return 0;
    
    try {
      let amount: number;
      
      if (typeof amountValue === 'number') {
        amount = amountValue;
      } else if (typeof amountValue === 'string') {
        // 清理字符串中的非数字字符
        const cleanAmount = amountValue.replace(/[^\d.-]/g, '');
        amount = parseFloat(cleanAmount);
      } else {
        amount = parseFloat(String(amountValue));
      }
      
      if (isNaN(amount)) {
        return 0;
      }
      
      return Math.round(amount * 100) / 100; // 保留两位小数
      
    } catch (error) {
      console.warn('金额解析失败:', amountValue, error);
      return 0;
    }
  }
  
  /**
   * 解析账户信息
   */
  private static parseAccountInfo(accountValue: any, flowType?: string): any {
    if (!accountValue) return null;
    
    const accountStr = String(accountValue).trim();
    
    // 如果是转账类型，解析转账账户信息
    if (flowType === '转账') {
      return this.parseTransferAccount(accountStr);
    } else {
      // 普通收入/支出，返回单个账户
      return {
        accountName: this.cleanAccountName(accountStr)
      };
    }
  }
  
  /**
   * 解析转账账户信息
   * 格式: "未来基金卡里流动: -600.00, 现金: +600.00"
   */
  private static parseTransferAccount(accountStr: string): any {
    try {
      console.log('解析转账账户字符串:', accountStr);
      
      // 使用更灵活的正则表达式匹配账户和金额
      // 支持中文冒号、英文冒号、逗号分隔
      const pattern = /([^：:,]+)[：:]([+-]?\d+\.?\d*)/g;
      const matches = [];
      let match;
      while ((match = pattern.exec(accountStr)) !== null) {
        matches.push(match);
      }
      
      console.log('正则匹配结果:', matches);
      
      if (matches.length >= 2) {
        const fromAccountRaw = matches[0][1].trim();
        const fromAccount = this.cleanAccountName(fromAccountRaw);
        const fromAmount = parseFloat(matches[0][2]);
        const toAccountRaw = matches[1][1].trim().replace(/^[，,、\s]+/, ''); // 移除开头的逗号
        const toAccount = this.cleanAccountName(toAccountRaw);
        const toAmount = parseFloat(matches[1][2]);
        
        console.log('转账解析结果:', {
          fromAccountRaw,
          fromAccount,
          toAccountRaw,
          toAccount,
          fromAmount,
          toAmount
        });
        
        // 验证账户名称不为空，如果为空则使用原始名称
        const finalFromAccount = fromAccount || fromAccountRaw || '未知账户';
        const finalToAccount = toAccount || toAccountRaw || '未知账户';
        
        return {
          isTransfer: true,
          fromAccount: finalFromAccount,
          toAccount: finalToAccount,
          fromAmount: Math.abs(fromAmount), // 转出金额（正数）
          toAmount: Math.abs(toAmount),     // 转入金额（正数）
          transferAmount: Math.abs(fromAmount) // 转账金额
        };
      } else {
        // 如果解析失败，当作普通账户处理
        console.warn('转账账户解析失败，当作普通账户处理:', accountStr);
        return {
          accountName: this.cleanAccountName(accountStr)
        };
      }
    } catch (error) {
      console.warn('转账账户解析出错:', accountStr, error);
      return {
        accountName: this.cleanAccountName(accountStr)
      };
    }
  }

  /**
   * 清理账户名称
   */
  private static cleanAccountName(nameValue: any): string {
    if (!nameValue) return '';
    
    let name = String(nameValue).trim();
    
    // 移除开头的逗号、空格等无效字符
    name = name.replace(/^[，,、\s]+/, '');
    
    // 移除结尾的逗号、空格等无效字符
    name = name.replace(/[，,、\s]+$/, '');
    
    // 移除数字后缀（如"支付宝总12000" -> "支付宝总", "建设银行储蓄卡17800" -> "建设银行储蓄卡"）
    name = name.replace(/[总]?\d+\.?\d*$/, '');
    
    // 移除银行卡类型后缀
    name = name.replace(/储蓄卡$|借记卡$|信用卡$|电子钱包$|微信支付$|银行卡$/g, '');
    
    // 合并多个空格
    name = name.replace(/\s+/g, ' ');
    
    // 移除特殊字符，但保留中文、英文、数字、空格和常见符号
    // 保留银行名称中可能包含的符号，如括号、连字符、冒号等
    name = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\(\)\-：:]/g, '');
    
    const result = name.trim();
    
    // 如果清理后为空，返回原始名称（去除明显后缀后）
    if (!result) {
      const fallback = String(nameValue).trim()
        .replace(/储蓄卡$|借记卡$|信用卡$|电子钱包$/g, '')
        .replace(/[总]?\d+\.?\d*$/, '')
        .trim();
      return fallback || String(nameValue).trim();
    }
    
    return result;
  }
  
  /**
   * 提取元数据
   */
  private static extractMetadata(dataRows: any[]): {
    bookName: string;
    totalCount: number;
    dateRange: { start: string; end: string };
  } {
    const totalCount = dataRows.length;
    let startDate = '';
    let endDate = '';
    
    // 从数据中提取日期范围
    const dates: string[] = [];
    dataRows.forEach(row => {
      if (row[0]) { // 假设第一列是日期
        const date = this.parseDate(row[0]);
        if (date) {
          dates.push(date);
        }
      }
    });
    
    if (dates.length > 0) {
      dates.sort();
      startDate = dates[0];
      endDate = dates[dates.length - 1];
    }
    
    return {
      bookName: '挖财数据', // 默认名称，实际会从账本信息中获取
      totalCount,
      dateRange: { start: startDate, end: endDate }
    };
  }
}

/**
 * 字段映射接口
 */
interface FieldMap {
  dateTime: number;
  type: number;
  category: number;
  amount: number;
  currency: number;
  account: number;
  remark: number;
  merchant: number;
  tag: number;
  participant: number;
  payer: number;
  attribute: number;
}

/**
 * 流水数据接口
 */
export interface FlowData {
  day?: string;
  flowType?: string;
  industryType?: string;
  money?: number;
  accountName?: string;
  description?: string;
  name?: string;
  // 转账相关字段
  isTransfer?: boolean;
  fromAccount?: string;
  toAccount?: string;
  fromAmount?: number;
  toAmount?: number;
  transferAmount?: number;
  // 借贷相关字段
  isLoan?: boolean;
  loanType?: string;        // 借贷类型：借入、借出、收款、还款
  counterparty?: string;    // 借贷对象
  loanAccountName?: string; // 借贷账户名称
  relatedFlowId?: number;   // 关联的对应流水ID
  // 显示字段
  displayFlowType?: string;    // 显示用的流水类型：借贷、转账
  displayIndustryType?: string; // 显示用的支出/收入类型：借款、还款、借入、收款、转账
}
