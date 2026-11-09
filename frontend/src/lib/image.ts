const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/**
 * Cắt vuông ở giữa và thu nhỏ ảnh về `size`px, xuất JPEG (nền trắng cho ảnh trong suốt).
 * Làm ở trình duyệt nên tệp gửi lên chỉ vài chục KB và EXIF/vị trí GPS bị loại bỏ.
 */
export async function toSquareJpeg(file: File, size = 256): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Vui lòng chọn một tệp ảnh');
  if (file.size > MAX_INPUT_BYTES) throw new Error('Ảnh quá lớn (tối đa 10MB)');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Không đọc được ảnh này, hãy thử ảnh JPEG hoặc PNG');
  }
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) throw new Error('Không xử lý được ảnh');
    return blob;
  } finally {
    bitmap.close();
  }
}
