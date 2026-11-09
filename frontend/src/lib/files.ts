import { File as FileIcon, FileArchive, FileCode, FileImage, FileSpreadsheet, FileText, Presentation, type LucideIcon } from 'lucide-react';
import type { FileCategory } from '../types/api';

/** Khớp phân nhóm ở backend (attachments/file-types.ts) */
const SPREADSHEET = new Set(['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.oasis.opendocument.spreadsheet', 'text/csv']);
const DOCUMENT = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/plain',
  'text/markdown',
  'text/html',
  'application/json',
  'application/xml',
  'application/yaml',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.presentation',
]);
const ARCHIVE = new Set(['application/zip', 'application/vnd.rar', 'application/x-7z-compressed', 'application/x-tar', 'application/gzip']);

export function categoryOf(mime: string): FileCategory {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (SPREADSHEET.has(mime)) return 'spreadsheet';
  if (DOCUMENT.has(mime)) return 'document';
  return 'other';
}

export const CATEGORY_LABEL: Record<FileCategory, string> = {
  image: 'Ảnh',
  pdf: 'PDF',
  document: 'Văn bản',
  spreadsheet: 'Bảng tính',
  other: 'Khác',
};
export const CATEGORIES = Object.keys(CATEGORY_LABEL) as FileCategory[];

const CODE = new Set(['text/html', 'application/json', 'application/xml', 'application/yaml']);
const SLIDES = new Set(['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.oasis.opendocument.presentation']);

export function iconFor(mime: string): LucideIcon {
  if (ARCHIVE.has(mime)) return FileArchive;
  if (CODE.has(mime)) return FileCode;
  if (SLIDES.has(mime)) return Presentation;
  switch (categoryOf(mime)) {
    case 'image':
      return FileImage;
    case 'spreadsheet':
      return FileSpreadsheet;
    case 'pdf':
    case 'document':
      return FileText;
    default:
      return FileIcon;
  }
}

export type PreviewKind = 'image' | 'pdf' | 'text' | 'csv' | 'html' | 'docx' | 'xlsx' | 'pptx';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** Cách dựng bản xem trước theo loại file; null = không xem trực tiếp được (khớp danh sách ở backend) */
export function previewKind(mime: string): PreviewKind | null {
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'].includes(mime)) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (['text/plain', 'text/markdown', 'application/json', 'application/xml', 'application/yaml'].includes(mime)) return 'text';
  if (mime === 'text/html') return 'html';
  if (mime === 'text/csv') return 'csv';
  if (mime === DOCX_MIME) return 'docx';
  if (mime === XLSX_MIME) return 'xlsx';
  if (mime === PPTX_MIME) return 'pptx';
  return null;
}

/** HTML được hiển thị trong khung sandbox: giới hạn để không treo trang */
export const MAX_HTML_PREVIEW_BYTES = 2 * 1024 * 1024;

/** Word/Excel/PowerPoint được dựng ngay trong trình duyệt nên giới hạn dung lượng để không treo trang */
export const MAX_OFFICE_PREVIEW_BYTES = 10 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Giới hạn khớp backend (chỉ để báo lỗi sớm; backend vẫn là nơi quyết định) */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;

/** Khớp BLOCKED_EXTENSIONS ở backend: file thực thi/script không được đính kèm */
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'cpl', 'dll', 'sys', 'sh', 'bash', 'zsh', 'csh', 'ps1', 'psm1',
  'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'hta', 'jar', 'apk', 'app', 'dmg', 'pkg', 'deb', 'rpm', 'reg', 'lnk', 'bin', 'run', 'php', 'py',
]);

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/**
 * Kiểm tra file người dùng vừa chọn/thả để báo lỗi NGAY (backend vẫn là nơi quyết định).
 * `existing` là các file đã chọn trước đó: bỏ file trùng, và tính tổng số file tối đa.
 */
export function validateIncomingFiles(existing: File[], incoming: File[]): { accepted: File[]; errors: string[] } {
  const accepted: File[] = [];
  const errors: string[] = [];
  for (const file of incoming) {
    const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
    if (BLOCKED_EXTENSIONS.has(ext)) errors.push(`"${file.name}": không nhận file thực thi hoặc script (.${ext})`);
    else if (file.size === 0) errors.push(`"${file.name}": file rỗng`);
    else if (file.size > MAX_UPLOAD_BYTES) errors.push(`"${file.name}": vượt quá ${formatBytes(MAX_UPLOAD_BYTES)} (${formatBytes(file.size)})`);
    else if ([...existing, ...accepted].some((f) => sameFile(f, file))) continue;
    else if (existing.length + accepted.length >= MAX_FILES_PER_UPLOAD) errors.push(`"${file.name}": chỉ chọn tối đa ${MAX_FILES_PER_UPLOAD} file mỗi lần`);
    else accepted.push(file);
  }
  return { accepted, errors };
}

/** "12 file · 35 MB" hoặc "Chưa có file" (dòng ghi dưới mỗi thư mục trong Kho tài liệu) */
export function folderSummary(stats: { fileCount: number; totalSize: number }): string {
  return stats.fileCount === 0 ? 'Chưa có file' : `${stats.fileCount} file · ${formatBytes(stats.totalSize)}`;
}
