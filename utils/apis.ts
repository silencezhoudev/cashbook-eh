import type { CommonChartData, MultiBookCalendarData, Book, TypeRelation } from "./model";

export const getSystemInfo = async () => {
  return await doApi.get("api/config");
};

export const daily = async (data: any): Promise<CommonChartData[]> => {
  return doApi.post<CommonChartData[]>("api/entry/analytics/daily", {
    ...data,
    bookId: localStorage.getItem("bookId"),
  });
};

export const getIndustryType = (flowType: string): Promise<any[]> => {
  return doApi.post<any[]>("api/entry/flow/type/getIndustryType", {
    flowType,
    bookId: localStorage.getItem("bookId"),
  });
};

export const getPayType = (flowType: string): Promise<any[]> => {
  return doApi.post<any[]>("api/entry/flow/type/getPayType", {
    flowType,
    bookId: localStorage.getItem("bookId"),
  });
};

export const getTypeRelation = (): Promise<TypeRelation[]> => {
  return doApi.post<TypeRelation[]>("api/entry/typeRelation/list", {
    bookId: localStorage.getItem("bookId"),
  });
};

// 多账本相关 API
export const multiBookDaily = async (
  bookIds: string[], 
  data: any
): Promise<MultiBookCalendarData> => {
  return doApi.post<MultiBookCalendarData>("api/entry/analytics/multi-book-daily", {
    ...data,
    bookIds
  });
};

export const updateBookColor = async (bookId: string, color: string): Promise<void> => {
  return doApi.post("api/entry/book/update-color", {
    bookId,
    color
  });
};

export const getBooksWithColors = async (): Promise<Book[]> => {
  return doApi.post<Book[]>("api/entry/book/list-with-colors", {});
};
