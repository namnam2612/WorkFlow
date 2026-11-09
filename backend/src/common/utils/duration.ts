const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** Chuyển chuỗi như "15m", "7d", "3600" (giây) thành số giây */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) throw new Error(`Thời lượng không hợp lệ: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  return amount * UNIT_SECONDS[unit];
}
