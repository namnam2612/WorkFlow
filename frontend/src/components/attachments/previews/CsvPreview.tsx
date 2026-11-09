import { useMemo } from 'react';
import { useBlobText } from '../../../hooks/useBlobText';
import { parseCsv } from '../../../lib/csv';
import { SheetTable } from './SheetTable';

export default function CsvPreview({ blob }: { blob: Blob }) {
  const { text, truncated } = useBlobText(blob);
  const rows = useMemo(() => (text === null ? null : parseCsv(text)), [text]);
  if (rows === null) return <p className="py-10 text-center text-sm text-slate-500">Đang đọc nội dung...</p>;
  return <SheetTable rows={rows} truncatedSource={truncated} />;
}
