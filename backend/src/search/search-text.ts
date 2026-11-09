/** Bỏ dấu tiếng Việt và hạ chữ thường: "Đăng nhập" -> "dang nhap" */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Các dạng cần thử trong MySQL cho một từ khóa. Collation utf8mb4_unicode_ci đã coi ă/â/ê/ô/ơ/ư và các dấu thanh
 * là chữ gốc, nhưng "đ" thì KHÁC "d" — nên gõ "dang" không khớp "đăng" nếu không thử thêm biến thể d → đ (và ngược lại).
 */
export function termVariants(term: string): string[] {
  return [...new Set([term, term.replace(/d/g, 'đ').replace(/D/g, 'Đ'), term.replace(/đ/g, 'd').replace(/Đ/g, 'D')])];
}

/** Tách từ khóa: bỏ ký tự thừa, tối đa 6 từ, mỗi từ tối đa 40 ký tự */
export function tokenize(query: string): string[] {
  return [...new Set(query.trim().split(/\s+/).map((t) => t.replace(/[%_\\]/g, '')).filter((t) => t.length > 0))].slice(0, 6).map((t) => t.slice(0, 40));
}

/**
 * Điểm liên quan: mỗi từ khóa có trong tiêu đề +3, trong nội dung +1; cụm đầy đủ trong tiêu đề +5.
 * So khớp không phân biệt hoa thường và không phân biệt dấu.
 */
export function relevance(terms: string[], title: string, body: string): number {
  const t = fold(title);
  const b = fold(body);
  let score = 0;
  for (const term of terms) {
    const f = fold(term);
    if (t.includes(f)) score += 3;
    if (b.includes(f)) score += 1;
  }
  if (terms.length > 1 && t.includes(fold(terms.join(' ')))) score += 5;
  return score;
}

/** Đoạn trích ~140 ký tự quanh vị trí khớp đầu tiên (khớp không dấu) để người dùng thấy ngữ cảnh */
export function snippet(terms: string[], text: string, width = 140): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean === '') return '';
  const folded = fold(clean);
  let at = -1;
  for (const term of terms) {
    const i = folded.indexOf(fold(term));
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return clean.slice(0, width) + (clean.length > width ? '…' : '');
  const start = Math.max(0, at - Math.floor(width / 3));
  const end = Math.min(clean.length, start + width);
  return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`;
}
