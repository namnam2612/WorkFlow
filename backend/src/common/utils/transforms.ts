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
