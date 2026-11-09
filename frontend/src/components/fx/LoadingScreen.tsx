import { useEffect, useState } from 'react';

const STORAGE_KEY = 'taskflow:loaded';
const DURATION_MS = 1800;

function alreadyShown(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Màn hình loading: bộ đếm 000 → 100, chỉ hiện ở lần mở trang đầu tiên của phiên. */
export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [skip] = useState(alreadyShown);
  const [count, setCount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(skip);

  useEffect(() => {
    if (skip) {
      onDone();
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      setCount(Math.round(progress * 100));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // bỏ qua: chỉ để lần sau không hiện lại
      }
      setLeaving(true);
      onDone();
      window.setTimeout(() => setGone(true), 800);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [skip, onDone]);

  if (gone) return null;
  return (
    <div
      role="status"
      aria-label="Đang tải"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-black transition-opacity duration-[800ms]"
      style={{ opacity: leaving ? 0 : 1, pointerEvents: leaving ? 'none' : 'auto' }}
    >
      <span className="tabular text-[clamp(80px,14vw,160px)] font-light leading-none text-white">{String(count).padStart(3, '0')}</span>
      <div className="h-px w-[120px] overflow-hidden bg-white/15">
        <div className="h-full bg-white" style={{ width: `${count}%` }} />
      </div>
      <span className="text-[11px] uppercase tracking-[4px] text-muted">Loading</span>
    </div>
  );
}
