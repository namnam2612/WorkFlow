import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { mkdir, open, rm, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { Readable } from 'stream';
import { StorageService } from './storage.service';

@Injectable()
export class LocalStorageService extends StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    super();
    this.root = resolve(config.get<string>('UPLOAD_DIR') ?? 'uploads');
  }

  /** Chặn path traversal: đường dẫn phải nằm trong thư mục gốc */
  private resolveKey(key: string): string {
    const full = resolve(join(this.root, key));
    const rel = relative(this.root, full);
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Đường dẫn lưu trữ không hợp lệ');
    return full;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const full = this.resolveKey(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data, { flag: 'wx' }); // wx: không bao giờ ghi đè file có sẵn
  }

  read(key: string): Promise<Readable> {
    const full = this.resolveKey(key);
    return new Promise((resolvePromise, reject) => {
      const stream = createReadStream(full);
      stream.once('open', () => resolvePromise(stream));
      stream.once('error', reject);
    });
  }

  async readHead(key: string, length: number): Promise<Buffer> {
    const handle = await open(this.resolveKey(key), 'r');
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async deleteDirectory(prefix: string): Promise<void> {
    try {
      await rm(this.resolveKey(prefix), { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(`Không xóa được thư mục ${prefix}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await rm(this.resolveKey(key), { force: true });
    } catch (error) {
      this.logger.warn(`Không xóa được file ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
