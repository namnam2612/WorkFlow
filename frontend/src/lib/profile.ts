/** Thêm https:// nếu người dùng chỉ gõ "github.com/abc" */
export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Kiểm tra link thuộc một trong các tên miền cho phép (khớp quy tắc ở backend) */
export function isUrlOnHosts(value: string, hosts: string[]): boolean {
  const normalized = normalizeUrl(value);
  if (normalized === '') return true;
  try {
    const url = new URL(normalized);
    return (url.protocol === 'https:' || url.protocol === 'http:') && hosts.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export const GITHUB_HOSTS = ['github.com', 'www.github.com'];
export const LINKEDIN_HOSTS = ['linkedin.com', 'www.linkedin.com'];
export const FACEBOOK_HOSTS = ['facebook.com', 'www.facebook.com', 'fb.com', 'www.fb.com'];

/** Số điện thoại giống quy tắc backend */
export const PHONE_PATTERN = /^\+?[0-9][0-9 ().-]{5,18}$/;
