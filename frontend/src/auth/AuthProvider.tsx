import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, AUTH_LOGOUT_EVENT } from '../lib/api';
import { TOKEN_STORAGE_KEYS, tokenStore } from '../lib/tokens';
import type { AuthResult, User } from '../types/api';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => tokenStore.getAccess() !== null || tokenStore.getRefresh() !== null);

  // Khôi phục phiên khi tải trang
  useEffect(() => {
    if (!tokenStore.getAccess() && !tokenStore.getRefresh()) return;
    let cancelled = false;
    api
      .get<User>('/auth/me')
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) tokenStore.clear();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Khi refresh token thất bại ở bất kỳ request nào -> đăng xuất
  useEffect(() => {
    const onForcedLogout = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, onForcedLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onForcedLogout);
  }, [queryClient]);

  // Token dùng chung giữa các tab (localStorage). Khi tab khác đăng nhập/đăng xuất, đồng bộ lại tab này
  // để giao diện luôn khớp tài khoản đang dùng token — tránh tab Admin hiển thị dữ liệu/thông báo của Member (và ngược lại).
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && !TOKEN_STORAGE_KEYS.includes(event.key)) return;
      queryClient.clear();
      if (!tokenStore.getAccess() && !tokenStore.getRefresh()) {
        setUser(null);
        return;
      }
      api
        .get<User>('/auth/me')
        .then(setUser)
        .catch(() => setUser(null));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.post<AuthResult>('/auth/login', { email, password }, true);
      tokenStore.set(result.accessToken, result.refreshToken);
      queryClient.clear();
      setUser(result.user);
      return result.user;
    },
    [queryClient],
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const result = await api.post<AuthResult>('/auth/register', input, true);
      tokenStore.set(result.accessToken, result.refreshToken);
      queryClient.clear();
      setUser(result.user);
      return result.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefresh();
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken }, true);
      } catch {
        /* bỏ qua — phiên local đã xóa */
      }
    }
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    setUser(await api.get<User>('/auth/me'));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
