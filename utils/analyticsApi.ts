import { doApi } from './api'
import type { CommonChartData } from './model'

// 单账本API（保持现有）
export const singleBookDaily = async (data: any): Promise<CommonChartData[]> => {
  return doApi.post<CommonChartData[]>("api/entry/analytics/daily", {
    ...data,
    bookId: localStorage.getItem("bookId"),
  });
};

export const singleBookMonth = async (data: any): Promise<CommonChartData[]> => {
  return doApi.post<CommonChartData[]>("api/entry/analytics/month", {
    ...data,
    bookId: localStorage.getItem("bookId"),
  });
};

export const singleBookCommon = async (data: any): Promise<CommonChartData[]> => {
  return doApi.post<CommonChartData[]>("api/entry/analytics/common", {
    ...data,
    bookId: localStorage.getItem("bookId"),
  });
};

// 多账本API（新增）
export const multiBookDaily = async (bookIds: string[], data: any): Promise<CommonChartData[]> => {
  return doApi.post<CommonChartData[]>("api/entry/analytics/multi-book-daily", {
    bookIds,
    ...data
  });
};

export const multiBookMonth = async (bookIds: string[], data: any): Promise<CommonChartData[]> => {
  return doApi.post<CommonChartData[]>("api/entry/analytics/multi-book-month", {
    bookIds,
    ...data
  });
};

export const multiBookCommon = async (bookIds: string[], data: any): Promise<any> => {
  return doApi.post<any>("api/entry/analytics/multi-book-common", {
    bookIds,
    ...data
  });
};

// 账户年内变动（相较年初）
export const accountDeltaByYear = async (selectedYear: string): Promise<{ year: string; startDay: string; endDay: string; data: { accountId: number; accountName: string; delta: number; }[] }> => {
  return doApi.post("api/entry/analytics/account-delta-by-year", { selectedYear });
};

// 兼容性包装函数
export const getAnalyticsData = async (endpoint: string, data: any, mode: string, selectedBookIds: string[]) => {
  if (mode === 'single') {
    // 使用现有单账本API
    switch (endpoint) {
      case 'daily':
        return singleBookDaily(data)
      case 'month':
        return singleBookMonth(data)
      case 'common':
        return singleBookCommon(data)
      default:
        throw new Error(`Unknown endpoint: ${endpoint}`)
    }
  } else {
    // 使用新的多账本API
    if (selectedBookIds.length === 0) {
      throw new Error('请选择至少一个账本')
    }
    
    switch (endpoint) {
      case 'daily':
        return multiBookDaily(selectedBookIds, data)
      case 'month':
        return multiBookMonth(selectedBookIds, data)
      case 'common':
        return multiBookCommon(selectedBookIds, data)
      default:
        throw new Error(`Unknown endpoint: ${endpoint}`)
    }
  }
}
