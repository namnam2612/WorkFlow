import clsx from 'clsx';
import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  /** Thứ tự trong nhóm: mỗi phần tử trễ thêm 70ms */
  index?: number;
  className?: string;
  as?: ElementType;
}

/** Mờ dần và trượt lên khi cuộn tới (IntersectionObserver, threshold 0.1, rootMargin -40px ở đáy) */
export function Reveal({ children, index = 0, className, as: Tag = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={clsx('reveal', visible && 'is-visible', className)}
      style={{ ['--reveal-delay' as string]: `${Math.min(index, 12) * 70}ms` }}
    >
      {children}
    </Tag>
  );
}
