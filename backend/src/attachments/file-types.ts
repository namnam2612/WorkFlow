import { extname } from 'path';

export type FileCategory = 'image' | 'pdf' | 'document' | 'spreadsheet' | 'other';
/** `file` = mọi thứ không phải ảnh (tab "Tài liệu" trong Kho tài liệu) */
export type FileTypeFilter = FileCategory | 'file';
export const FILE_CATEGORIES: readonly FileCategory[] = ['image', 'pdf', 'document', 'spreadsheet', 'other'];
export const FILE_TYPE_FILTERS: readonly FileTypeFilter[] = [...FILE_CATEGORIES, 'file'];

interface TypeInfo {
  mime: string;
  category: FileCategory;
}

/** Loại file cho phép nhận diện theo đuôi. Đuôi lạ vẫn được nhận (thành `other`) trừ khi nằm trong danh sách chặn. */
const BY_EXTENSION: Record<string, TypeInfo> = {
  jpg: { mime: 'image/jpeg', category: 'image' },
  jpeg: { mime: 'image/jpeg', category: 'image' },
  png: { mime: 'image/png', category: 'image' },
  gif: { mime: 'image/gif', category: 'image' },
  webp: { mime: 'image/webp', category: 'image' },
  bmp: { mime: 'image/bmp', category: 'image' },
  svg: { mime: 'image/svg+xml', category: 'image' },
  pdf: { mime: 'application/pdf', category: 'pdf' },
  doc: { mime: 'application/msword', category: 'document' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'document' },
  odt: { mime: 'application/vnd.oasis.opendocument.text', category: 'document' },
  rtf: { mime: 'application/rtf', category: 'document' },
  txt: { mime: 'text/plain', category: 'document' },
  md: { mime: 'text/markdown', category: 'document' },
  html: { mime: 'text/html', category: 'document' },
  htm: { mime: 'text/html', category: 'document' },
  json: { mime: 'application/json', category: 'document' },
  xml: { mime: 'application/xml', category: 'document' },
  yaml: { mime: 'application/yaml', category: 'document' },
  yml: { mime: 'application/yaml', category: 'document' },
  log: { mime: 'text/plain', category: 'document' },
  ppt: { mime: 'application/vnd.ms-powerpoint', category: 'document' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', category: 'document' },
  odp: { mime: 'application/vnd.oasis.opendocument.presentation', category: 'document' },
  xls: { mime: 'application/vnd.ms-excel', category: 'spreadsheet' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: 'spreadsheet' },
  ods: { mime: 'application/vnd.oasis.opendocument.spreadsheet', category: 'spreadsheet' },
  csv: { mime: 'text/csv', category: 'spreadsheet' },
  zip: { mime: 'application/zip', category: 'other' },
  rar: { mime: 'application/vnd.rar', category: 'other' },
  '7z': { mime: 'application/x-7z-compressed', category: 'other' },
  tar: { mime: 'application/x-tar', category: 'other' },
  gz: { mime: 'application/gzip', category: 'other' },
};

/** File thực thi / script: không cho đính kèm */
export const BLOCKED_EXTENSIONS: ReadonlySet<string> = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'cpl', 'dll', 'sys', 'sh', 'bash', 'zsh', 'csh', 'ps1', 'psm1',
  'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'hta', 'jar', 'apk', 'app', 'dmg', 'pkg', 'deb', 'rpm', 'reg', 'lnk', 'bin', 'run', 'php', 'py',
]);

export function extensionOf(fileName: string): string {
  return extname(fileName).slice(1).toLowerCase();
}

export function mimeFor(fileName: string): string {
  return BY_EXTENSION[extensionOf(fileName)]?.mime ?? 'application/octet-stream';
}

export function categoryOfMime(mime: string): FileCategory {
  for (const info of Object.values(BY_EXTENSION)) if (info.mime === mime) return info.category;
  return 'other';
}

/** Các mime thuộc một nhóm (để lọc trong DB). `other` = mọi mime không thuộc 4 nhóm còn lại. */
export function mimesOfCategory(category: Exclude<FileCategory, 'other'>): string[] {
  return [...new Set(Object.values(BY_EXTENSION).filter((i) => i.category === category).map((i) => i.mime))];
}

export function allKnownNonOtherMimes(): string[] {
  return (['image', 'pdf', 'document', 'spreadsheet'] as const).flatMap(mimesOfCategory);
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const TEXT_PREVIEW = new Set(['text/plain', 'text/markdown', 'text/csv', 'text/html', 'application/json', 'application/xml', 'application/yaml']);
const ZIP_PREVIEW = new Set([DOCX, XLSX, PPTX]);

/**
 * Xem trực tiếp trên web: ảnh (kể cả SVG — giao diện chỉ hiển thị qua thẻ <img> nên script trong SVG không chạy),
 * PDF, văn bản/Markdown/CSV/JSON/XML/YAML, HTML (khung sandbox không script), Word, Excel, PowerPoint.
 * Giao diện tự dựng bản xem trước ở trình duyệt, không gửi file cho dịch vụ bên thứ ba.
 */
const PREVIEWABLE = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml', 'application/pdf', ...ZIP_PREVIEW, ...TEXT_PREVIEW]);
export const isPreviewableMime = (mime: string): boolean => PREVIEWABLE.has(mime);

/** Nội dung thật có khớp loại khai báo không (không tin đuôi file). `head` = vài trăm byte đầu. */
export function matchesPreviewSignature(mime: string, head: Buffer): boolean {
  if (TEXT_PREVIEW.has(mime)) return head.length > 0 && !head.includes(0); // văn bản thuần không chứa byte NUL
  if (mime === 'image/svg+xml') return /<svg[\s>]|<\?xml/i.test(head.toString('utf8')) && !head.includes(0);
  if (mime === 'image/bmp') return head.length >= 2 && head[0] === 0x42 && head[1] === 0x4d;
  if (ZIP_PREVIEW.has(mime)) return head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04; // ZIP (docx/xlsx/pptx)
  return sniffMime(head) === mime;
}

/** Nhận diện nội dung thực thi bằng chữ ký (phòng trường hợp đổi đuôi file) */
export function looksExecutable(buf: Buffer): boolean {
  if (buf.length >= 4 && buf[0] === 0x7f && buf.subarray(1, 4).toString('ascii') === 'ELF') return true; // Linux
  if (buf.length >= 2 && buf[0] === 0x23 && buf[1] === 0x21) return true; // shebang #!
  if (buf.length >= 4) {
    const magic = buf.readUInt32BE(0);
    // Mach-O (macOS), cả big/little endian, 32/64 bit và universal
    if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(magic)) {
      // 0xcafebabe cũng là chữ ký class Java; cả hai đều là mã thực thi
      return true;
    }
  }
  // Windows PE: 'MZ' và e_lfanew trỏ tới 'PE\0\0'
  if (buf.length >= 0x40 && buf[0] === 0x4d && buf[1] === 0x5a) {
    const offset = buf.readUInt32LE(0x3c);
    if (offset + 4 <= buf.length && buf.subarray(offset, offset + 4).equals(Buffer.from([0x50, 0x45, 0, 0]))) return true;
  }
  return false;
}

/** Kiểm tra chữ ký thật của ảnh/PDF — dùng khi xem trực tiếp để không tin đuôi file */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 6 && ['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

/**
 * Multer giải mã tên file multipart theo latin1 nên tên tiếng Việt bị vỡ (mojibake).
 * Nếu chuỗi toàn ký tự <= 0xFF và giải mã lại bằng UTF-8 hợp lệ thì đó là tên bị vỡ -> sửa lại.
 */
export function fixFileNameEncoding(name: string): string {
  if (![...name].every((ch) => ch.charCodeAt(0) <= 0xff)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}

/** Làm sạch tên file người dùng: bỏ đường dẫn, ký tự điều khiển, giới hạn độ dài 255 */
export function sanitizeFileName(raw: string): string {
  const base = [...fixFileNameEncoding(raw).replace(/[\\/]/g, '_')]
    .filter((ch) => ch.charCodeAt(0) > 0x1f && ch.charCodeAt(0) !== 0x7f)
    .join('')
    .trim();
  const name = base === '' || base === '.' || base === '..' ? 'tep-khong-ten' : base;
  if (name.length <= 255) return name;
  const ext = extname(name);
  return name.slice(0, 255 - ext.length) + ext;
}

/** Header Content-Disposition an toàn cho tên tiếng Việt (RFC 5987/6266) */
export function contentDisposition(type: 'attachment' | 'inline', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
