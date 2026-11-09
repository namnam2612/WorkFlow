import clsx from 'clsx';

/** Logo chữ in hoa: nửa đầu đậm, nửa sau mảnh và mờ */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={clsx('text-lg uppercase tracking-tight text-white', className)}>
      <span className="font-extrabold">Task</span>
      <span className="font-light opacity-55">Flow</span>
    </span>
  );
}
