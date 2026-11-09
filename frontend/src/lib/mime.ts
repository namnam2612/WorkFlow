const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
  json: 'application/json',
  xml: 'application/xml',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
};

/** Đoán loại file ở trình duyệt CHỈ để chọn biểu tượng (loại thật do backend quyết định theo đuôi) */
export function guessMime(file: File): string {
  const ext = file.name.includes('.') ? (file.name.split('.').pop()?.toLowerCase() ?? '') : '';
  return BY_EXTENSION[ext] ?? file.type ?? 'application/octet-stream';
}
