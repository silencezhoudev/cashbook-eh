interface ProgressEntry<T = any> {
  payload: T;
  updatedAt: number;
}

const progressStore = new Map<string, ProgressEntry>();

export const setProgressPayload = <T>(token: string, payload: T) => {
  if (!token) {
    return;
  }
  progressStore.set(token, { payload, updatedAt: Date.now() });
};

export const getProgressPayload = <T>(token: string): T | null => {
  if (!token) {
    return null;
  }
  return (progressStore.get(token)?.payload as T) || null;
};

export const clearProgressPayload = (token: string) => {
  if (!token) {
    return;
  }
  progressStore.delete(token);
};

// 可选：清理过期记录，避免内存增长
const EXPIRATION_MS = 10 * 60 * 1000; // 10 分钟

const cleanupProgressStore = () => {
  const now = Date.now();
  for (const [token, entry] of progressStore.entries()) {
    if (now - entry.updatedAt > EXPIRATION_MS) {
      progressStore.delete(token);
    }
  }
};

setInterval(cleanupProgressStore, EXPIRATION_MS).unref();

