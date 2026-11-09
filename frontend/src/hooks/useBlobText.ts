import { useEffect, useState } from 'react';

const MAX_CHARS = 300_000;

/** Đọc tối đa MAX_CHARS ký tự đầu của một Blob văn bản (UTF-8) */
export function useBlobText(blob: Blob): { text: string | null; truncated: boolean } {
  const [state, setState] = useState<{ blob: Blob; text: string; truncated: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Đọc dư một chút so với giới hạn rồi cắt theo ký tự để không cắt giữa ký tự nhiều byte
    void blob.slice(0, MAX_CHARS * 4).text().then((raw) => {
      if (cancelled) return;
      setState({ blob, text: raw.slice(0, MAX_CHARS), truncated: raw.length > MAX_CHARS || blob.size > MAX_CHARS * 4 });
    });
    return () => {
      cancelled = true;
    };
  }, [blob]);
  return state && state.blob === blob ? { text: state.text, truncated: state.truncated } : { text: null, truncated: false };
}
