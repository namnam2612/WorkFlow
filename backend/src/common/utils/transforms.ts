/** Chuyển 'true'/'false' (query string) thành boolean; giá trị khác giữ nguyên để validator bắt lỗi */
export function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

/** Chuỗi rỗng (sau khi trim) => null: cho phép người dùng xóa một trường hồ sơ */
export function emptyToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** "1,2,3" hoặc ?k=1&k=2 (query string) hoặc mảng => number[]; giá trị không phải số giữ NaN để validator bắt lỗi */
export function toNumberList({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [value];
  return parts.map((part) => (typeof part === 'number' ? part : typeof part === 'string' && part.trim() !== '' ? Number(part) : Number.NaN));
}
