import clsx from 'clsx';
import { useRef, type ReactNode } from 'react';
import { isTouchDevice, prefersReducedMotion } from '../../lib/motion';

/** Thẻ nghiêng 3D theo chuột. Tắt trên thiết bị cảm ứng và khi giảm chuyển động. */
export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  const apply = (value: string) => {
    if (ref.current) ref.current.style.transform = value;
  };

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || isTouchDevice() || prefersReducedMotion() || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rotateX = (y - rect.height / 2) / 16;
    const rotateY = (rect.width / 2 - x) / 16;
    apply(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`);
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => apply('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)')}
      className={clsx(
        'h-full transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform hover:shadow-[0_22px_50px_rgba(0,0,0,0.5)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
