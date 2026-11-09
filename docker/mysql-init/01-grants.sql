-- Cho phép user ứng dụng tạo shadow database khi chạy `prisma migrate dev`
GRANT ALL PRIVILEGES ON `prisma_migrate_shadow_db_%`.* TO 'taskflow'@'%';
FLUSH PRIVILEGES;
