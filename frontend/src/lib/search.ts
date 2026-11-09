/** Bỏ dấu tiếng Việt, hạ chữ thường; giữ nguyên độ dài với văn bản đã chuẩn hóa NFC để vị trí khớp trùng với văn bản gốc */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export interface Segment {
  text: string;
  match: boolean;
}

/** Cắt `text` thành các đoạn khớp / không khớp từ khóa, không phân biệt hoa thường và dấu */
export function highlightSegments(text: string, terms: string[]): Segment[] {
  const nfc = text.normalize('NFC');
  const folded = fold(nfc);
  if (folded.length !== nfc.length || terms.length === 0) return [{ text: nfc, match: false }];
  const marked = new Array<boolean>(nfc.length).fill(false);
  for (const term of terms) {
    const f = fold(term.normalize('NFC'));
    if (f === '') continue;
    for (let i = folded.indexOf(f); i !== -1; i = folded.indexOf(f, i + f.length)) {
      for (let k = i; k < i + f.length; k++) marked[k] = true;
    }
  }
  const segments: Segment[] = [];
  for (let i = 0; i < nfc.length; i++) {
    const match = marked[i] === true;
    const last = segments[segments.length - 1];
    if (last && last.match === match) last.text += nfc[i];
    else segments.push({ text: nfc[i] ?? '', match });
  }
  return segments;
}
