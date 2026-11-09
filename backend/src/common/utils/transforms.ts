/** Chuyển 'true'/'false' (query string) thành boolean; giá trị khác giữ nguyên để validator bắt lỗi */
export function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
