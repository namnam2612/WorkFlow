import { createHash, randomBytes } from 'crypto';

/** Token ngẫu nhiên 192 bit, an toàn cho URL (không đoán được) */
export const generateToken = (): string => randomBytes(24).toString('base64url');

/** DB chỉ lưu băm: lộ DB cũng không lộ được liên kết đang dùng */
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** Token hợp lệ về hình dạng? (chặn sớm đầu vào lạ trước khi chạm DB) */
export const looksLikeToken = (value: string): boolean => /^[A-Za-z0-9_-]{20,64}$/.test(value);
