import { tokenStore } from './tokens';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export const AUTH_LOGOUT_EVENT = 'taskflow:auth-logout';

export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Không tự refresh token khi nhận 401 (dùng cho login/refresh) */
  skipAuthRefresh?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = 'Đã có lỗi xảy ra, vui lòng thử lại';
  let details: string[] = [];
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      details = data.message;
      message = data.message[0] ?? message;
    } else if (typeof data.message === 'string') {
      message = data.message;
    }
  } catch {
    /* phản hồi không phải JSON */
  }
  return new ApiError(response.status, message, details);
}

// Chỉ cho phép MỘT request refresh tại một thời điểm — refresh token xoay vòng nên gọi song song sẽ làm hỏng phiên
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return false;
  try {
    const response = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { accessToken: string; refreshToken: string };
    tokenStore.set(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function refreshOnce(): Promise<boolean> {
  refreshPromise ??= refreshTokens().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  const isForm = options.body instanceof FormData;
  // FormData: để trình duyệt tự đặt Content-Type (kèm boundary)
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const access = tokenStore.getAccess();
  if (access) headers.Authorization = `Bearer ${access}`;
  return fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
  });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 401 && !options.skipAuthRefresh && tokenStore.getRefresh()) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      response = await send(path, options);
    } else {
      tokenStore.clear();
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown, skipAuthRefresh = false) =>
    request<T>(path, { method: 'POST', body: body ?? {}, skipAuthRefresh }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Đã có lỗi xảy ra, vui lòng thử lại';
}
