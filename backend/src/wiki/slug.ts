/** "Hướng dẫn cài đặt API v2!" -> "huong-dan-cai-dat-api-v2" (bỏ dấu tiếng Việt, chỉ giữ chữ-số-gạch ngang) */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug === '' ? 'trang' : slug;
}

/** Slug chưa bị dùng: thêm -2, -3... khi trùng */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 10_000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** Đặt `parentId` cho `id` có tạo vòng không (cha chính nó hoặc là hậu duệ của nó)? */
export function wouldCreateTreeCycle(parents: ReadonlyMap<number, number | null>, id: number, newParentId: number | null): boolean {
  let current: number | null = newParentId;
  const seen = new Set<number>();
  while (current !== null) {
    if (current === id) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    current = parents.get(current) ?? null;
  }
  return false;
}
