import { createContext } from 'react';
import type { User } from '../types/api';

export interface AuthContextValue {
  user: User | null;
  /** true khi đang kiểm tra phiên đăng nhập ban đầu */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
