import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { deflateSync } from 'zlib';

/** Tiện ích cho seed: tạo file mẫu trong UPLOAD_DIR và dọn file khi xóa dữ liệu. */
export const uploadRoot = (): string => resolve(process.env.UPLOAD_DIR ?? 'uploads');

/** Xóa file trên ổ đĩa của mọi bản ghi Attachment rồi xóa bản ghi (gọi trước khi xóa task/user) */
export async function clearAttachments(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.attachment.findMany({ select: { path: true } });
  await Promise.all(rows.map((r) => rm(join(uploadRoot(), r.path), { force: true })));
  await prisma.attachment.deleteMany();
}

export interface SampleFile {
  name: string;
  mime: string;
  data: Buffer;
}

/** Ghi file vào UPLOAD_DIR theo đúng quy ước của StorageService (YYYY/MM/<uuid>.<đuôi>) và trả về metadata */
export async function writeSample(file: SampleFile): Promise<{ storedName: string; path: string; size: number }> {
  const now = new Date();
  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  const storedName = `${randomUUID()}${ext ? `.${ext}` : ''}`;
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${storedName}`;
  const full = join(uploadRoot(), path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, file.data);
  return { storedName, path, size: file.data.length };
}

function crc32(buf: Buffer): number {
  let c: number;
  let crc = 0xffffffff;
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** PNG hợp lệ, ảnh chuyển màu nhẹ (để có ảnh thu nhỏ trong Kho tài liệu) */
export function makePng(width: number, height: number, hue: number): Buffer {
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      row[1 + x * 3] = Math.min(255, (hue + (x * 255) / width) % 256);
      row[2 + x * 3] = Math.min(255, (y * 255) / height);
      row[3 + x * 3] = 200 - Math.floor((x * 100) / width);
    }
    rows.push(row);
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // 8 bit
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** PDF một trang đơn giản, hợp lệ (ASCII để tránh phải nhúng font) */
export function makePdf(title: string): Buffer {
  const text = title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[()\\]/g, '');
  const stream = `BT /F1 20 Tf 60 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}
