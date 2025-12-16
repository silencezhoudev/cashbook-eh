const prefiex = "api/entry/book";

export const page = (
  page: PageParam,
  param: Book
): Promise<{ total: number; data: Book[] }> => {
  return doApi.post(`${prefiex}/page`, { ...page, ...param });
};

export const add = (data: Book): Promise<string> => {
  return doApi.post(`${prefiex}/add`, data);
};

export const del = (id: number): Promise<string> => {
  return doApi.post(`${prefiex}/del`, { id });
};

export const update = (data: Book): Promise<string> => {
  return doApi.post(`${prefiex}/update`, data);
};

export const list = (data: Book): Promise<Book[]> => {
  return doApi.post(`${prefiex}/list`, data);
};

export const all = (): Promise<Book[]> => {
  return doApi.post(`${prefiex}/all`, {});
};

export const bootstrapRules = (payload: {
  userId?: number;
  adminAccount: string;
  adminPassword: string;
}): Promise<any> => {
  return doApi.post(`api/admin/rules/bootstrap`, payload);
};

export const rebuildProfile = (payload: {
  bookId?: string;
}): Promise<any> => {
  return doApi.post(`api/book/profile/rebuild`, payload);
};

export const exportProfileKeywords = (payload: { bookId: string }): Promise<any> => {
  return doApi.post(`api/book/profile/export-keywords`, payload);
};

export const importProfileKeywords = (payload: {
  bookId: string;
  data: any;
  override?: boolean;
  topN?: number;
}): Promise<any> => {
  return doApi.post(`api/book/profile/import-keywords`, payload);
};
