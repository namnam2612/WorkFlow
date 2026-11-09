const ACCESS_KEY = 'taskflow.accessToken';
const REFRESH_KEY = 'taskflow.refreshToken';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* localStorage không khả dụng */
  }
}

/** Khóa localStorage chứa token — dùng để nhận biết tab khác vừa đổi phiên đăng nhập */
export const TOKEN_STORAGE_KEYS: readonly string[] = [ACCESS_KEY, REFRESH_KEY];

export const tokenStore = {
  getAccess: (): string | null => safeGet(ACCESS_KEY),
  getRefresh: (): string | null => safeGet(REFRESH_KEY),
  set(access: string, refresh: string): void {
    safeSet(ACCESS_KEY, access);
    safeSet(REFRESH_KEY, refresh);
  },
  clear(): void {
    safeSet(ACCESS_KEY, null);
    safeSet(REFRESH_KEY, null);
  },
};
