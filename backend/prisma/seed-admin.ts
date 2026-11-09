import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { clearAttachments } from './seed-files';

/**
 * Tạo (hoặc cập nhật) duy nhất tài khoản admin.
 *   npm run seed:admin      -> giữ nguyên dữ liệu hiện có, chỉ đảm bảo admin tồn tại
 *   npm run reset           -> XÓA TOÀN BỘ dữ liệu rồi chỉ tạo lại admin
 * Cấu hình qua env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@taskflow.vn').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'Password123!';
  const name = process.env.ADMIN_NAME ?? 'Quản trị viên';
  const reset = process.argv.includes('--reset');

  if (reset) {
    console.log('XÓA TOÀN BỘ dữ liệu...');
    await clearAttachments(prisma); // xóa cả file trên ổ đĩa
    await prisma.notification.deleteMany();
    await prisma.activityLog.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.task.deleteMany({ where: { parentId: { not: null } } });
    await prisma.task.deleteMany();
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'admin', isActive: true, passwordHash, name },
    create: { email, name, role: 'admin', passwordHash },
  });
  console.log(`Admin sẵn sàng: ${admin.email} (mật khẩu: ${password})`);
  if (password === 'Password123!') console.log('Lưu ý: đang dùng mật khẩu mặc định — hãy đặt ADMIN_PASSWORD khi triển khai thật.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
