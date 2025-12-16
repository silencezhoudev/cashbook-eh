// 统一最外层包装类
export interface Result<T> {
  c: number;
  d: T;
  m?: string;
}

export interface Page<T> {
  pageNum: number;
  pageSize: number;
  pages: number;
  total: number;
  totalOut: number;
  totalIn: number;
  notInOut: number;
  data: T[];
}

// 分页查询参数
export interface PageParam {
  pageNum: number;
  pageSize: number;
}
export interface UserInfo {
  id: number;
  name: string;
  username: string;
  createDate: Date;
}

export interface MonthAnalysis {
  month: string;
  outSum: string; // 总支出
  inSum: string; // 总收入
  zeroSum: string; // 总不计收支
  maxInType: string; // 最大收入类型
  maxInTypeSum: string; // 最大收入金额
  maxOutType: string; // 最大支出类型
  maxOutTypeSum: string; // 最大支出金额
  maxOut: Flow; // 最大单笔支出
  maxIn: Flow; // 最大单笔收入
  maxZero: Flow; // 最大单笔收入
}

/**
 * 创建流水的传输实体
 */
export interface CreateFlowDto {
  day?: string;
  flowType?: string;
  bookId?: number | string;
  type?: string;
  payType?: string;
  money?: number;
  name?: string;
  description?: string;
  // 借贷相关字段
  loanType?: string;        // 借贷类型：借入、借出、收款、还款
  counterparty?: string;    // 借贷对象
  relatedFlowId?: number;   // 关联的对应流水ID
}

/**
 * 更新流水的传输实体
 */
export interface UpdateFlowDto {
  day?: string;
  bookId?: number | string;
  flowType?: string;
  type?: string;
  payType?: string;
  money?: number;
  name?: string;
  description?: string;
  // 借贷相关字段
  loanType?: string;        // 借贷类型：借入、借出、收款、还款
  counterparty?: string;    // 借贷对象
  relatedFlowId?: number;   // 关联的对应流水ID
}


export interface Server {
  version?: string;
  dataPath?: string;
  openRegister?: string;
}

export interface AdminLogin {
  account?: string;
  password?: string;
}

export interface CommonChartQuery {
  bookId?: string;
  flowType?: string;
  startDay?: string;
  endDay?: string;
  groupBy?: string; // 新增：分组字段，用于通用接口
}
export interface CommonChartData {
  type: string; // 数据标记 key，可能是日期、年月、支出类型、收入类型等，视具体使用场景而定
  inSum: number; // 收入
  outSum: number; // 支出
  zeroSum: number; // 不计收支
}

export interface Typer {
  bookId?: string;
  flowType?: string;
  type?: string;
  value?: string;
  oldValue?: string;
}

export interface CommonSelectOption {
  title: string;
  value: string;
}

// 账户相关类型定义
export interface Account {
  id: number;
  bookId: string;
  userId: number;
  name: string;
  type: string;
  balance: number;
  currency: string;
  createDate: Date;
  updateDate: Date;
}

export interface Transfer {
  id: number;
  bookId: string;
  userId: number;
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  day: string;
  name?: string;
  description?: string;
  createDate: Date;
}

// 更新Flow接口
export interface Flow {
  id: number;
  userId: number;
  bookId: string;
  day: string;
  flowType?: string;
  industryType?: string;
  payType?: string;
  money?: number;
  name?: string;
  description?: string;
  invoice?: string;
  origin?: string;
  attribution?: string;
  eliminate?: number;
  // 新增字段
  accountId?: number;
  transferId?: number;
  // 借贷相关字段
  loanType?: string;        // 借贷类型：借入、借出、收款、还款
  counterparty?: string;    // 借贷对象
  relatedFlowId?: number;   // 关联的对应流水ID
}

// 更新查询参数
export class FlowQuery {
  pageNum?: number = 1;
  pageSize?: number = 100;
  id?: string | number;
  bookId?: string | number;
  startDay?: string;
  endDay?: string;
  flowType?: string;
  industryType?: string;
  payType?: string;
  name?: string;
  attribution?: string;
  description?: string;
  moneySort?: string;
  // 新增字段
  accountId?: number;
  transferId?: number;
  // 多账本查询字段
  selectedBookIds?: string[];
}

// 账本相关类型定义
export interface Book {
  id: number;
  bookId: string;
  bookName: string;
  userId: number;
  createDate: Date;
  shareKey?: string;
  budget?: number;
  color?: string;
  description?: string;
  profileSummary?: string;
}

// 多账本日历相关类型
export interface BookFlowData {
  bookId: string;
  bookName: string;
  color: string;
  income: number;
  expense: number;
  zero: number;
}

export interface MultiBookCalendarData {
  [date: string]: {
    [bookId: string]: BookFlowData;
  };
}

export interface BookColor {
  bookId: string;
  color: string;
  bookName: string;
}

// 类型映射（TypeRelation）
export interface TypeRelation {
  id: number;
  userId: number;
  bookId: string; // 账本业务ID，模板数据使用 "0"
  bookDbId?: number; // 可选：展示用的账本数据库ID
  bookName?: string; // 可选：展示用的账本名称
  source: string; // 源类型
  target: string; // 目标类型
  createDate?: Date;
  updateDate?: Date;
}

// 账户查询参数
export class AccountQuery {
  bookId?: string;
  userId?: number;
  name?: string;
  type?: string;
  includeInactive?: boolean;
}

// 转账查询参数
export class TransferQuery {
  bookId?: string;
  userId?: number;
  fromAccountId?: number;
  toAccountId?: number;
  startDay?: string;
  endDay?: string;
  pageNum?: number = 1;
  pageSize?: number = 100;
}

// 系统设置类型定义
export interface SystemSetting {
  id: number;
  title?: string;
  description?: string;
  keywords?: string;
  version?: string;
  openRegister: boolean;
  createDate: Date;
  updateBy: Date;
}
