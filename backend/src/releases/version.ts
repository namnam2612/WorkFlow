const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z][0-9A-Za-z.-]*)?$/i;

/** "1.1.0" / "V1.1.0" -> "v1.1.0"; "v2.0.0-rc.1" giữ hậu tố; sai định dạng => null */
export function normalizeVersion(input: string): string | null {
  const match = SEMVER.exec(input.trim());
  if (!match) return null;
  return `v${Number(match[1])}.${Number(match[2])}.${Number(match[3])}${match[4] ?? ''}`;
}

/** So sánh hai version đã chuẩn hóa theo semver (bản có hậu tố -pre nhỏ hơn bản chính thức). <0: a < b */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const m = SEMVER.exec(v);
    return m ? { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? '' } : { nums: [0, 0, 0], pre: '' };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0);
    if (d !== 0) return d;
  }
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === '') return 1;
  if (pb.pre === '') return -1;
  return pa.pre < pb.pre ? -1 : 1;
}
