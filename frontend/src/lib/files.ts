import { File as FileIcon, FileArchive, FileImage, FileSpreadsheet, FileText, type LucideIcon } from 'lucide-react';
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

export function iconFor(mime: string): LucideIcon {
  if (ARCHIVE.has(mime)) return FileArchive;
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Giới hạn khớp backend (chỉ để báo lỗi sớm; backend vẫn là nơi quyết định) */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;
