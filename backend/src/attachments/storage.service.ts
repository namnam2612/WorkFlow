import { Readable } from 'stream';

/**
 * Cổng lưu trữ file. Hiện dùng ổ đĩa local (LocalStorageService); muốn chuyển sang S3/MinIO chỉ cần viết
 * một lớp khác kế thừa StorageService và đổi provider trong AttachmentsModule — phần còn lại không đổi.
 * `key` là đường dẫn tương đối (vd 2026/11/<uuid>.pdf), cũng là giá trị lưu ở cột Attachment.path.
 */
export abstract class StorageService {
  abstract save(key: string, data: Buffer): Promise<void>;
  /** Trả về luồng đọc; ném lỗi nếu file không tồn tại */
  abstract read(key: string): Promise<Readable>;
  /** Đọc tối đa `length` byte đầu (để nhận diện định dạng) */
  abstract readHead(key: string, length: number): Promise<Buffer>;
  /** Xóa file; không lỗi nếu file đã không còn */
  abstract delete(key: string): Promise<void>;
}
