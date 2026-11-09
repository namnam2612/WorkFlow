export const inputClass =
  'block w-full rounded-[10px] border border-white/[0.08] bg-field px-3.5 py-3 text-sm text-white placeholder:text-slate-400 transition-colors duration-300 focus:border-white/35 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-red-400';

export const labelClass = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[1px] text-muted';

/** Chip lọc: viên thuốc viền mờ, chữ muted; khi được chọn thì nền trắng chữ đen */
export const chipClass = (active: boolean) =>
  `rounded-full border px-4 py-1.5 text-sm font-medium transition-[background-color,color,border-color] duration-300 ${
    active ? 'border-white bg-white text-black' : 'border-white/[0.08] text-muted hover:border-white/25 hover:text-white'
  }`;
