/** 150 -> "2g 30p"; 60 -> "1g"; 45 -> "45p"; 0 -> "0" */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h > 0 ? `${h}g` : '', m > 0 ? `${m}p` : ''].filter(Boolean).join(' ');
}

/** Hiểu "1h30", "1.5", "90m", "2g", "1g 30p", "45" (không đơn vị = phút nếu >= 8, ngược lại giờ) -> số phút, null nếu sai */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(',', '.');
  if (text === '') return null;
  const hm = /^(\d+(?:\.\d+)?)\s*(?:h|g|giờ)\s*(?:(\d+)\s*(?:m|p|phút)?)?$/.exec(text);
  if (hm) return Math.round(Number(hm[1]) * 60 + Number(hm[2] ?? 0));
  const m = /^(\d+)\s*(?:m|p|phút)$/.exec(text);
  if (m) return Number(m[1]);
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    return n >= 8 ? Math.round(n) : Math.round(n * 60);
  }
  return null;
}
