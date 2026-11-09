-- Một công việc giao được cho NHIỀU người: thay cột Task.assigneeId bằng bảng nối TaskAssignee.
-- Thứ tự quan trọng để không mất dữ liệu: tạo bảng mới -> SAO CHÉP assigneeId cũ -> chỉ sau đó mới xóa cột cũ.

-- CreateTable
CREATE TABLE `TaskAssignee` (
    `taskId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskAssignee_userId_idx`(`userId`),
    PRIMARY KEY (`taskId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaskAssignee` ADD CONSTRAINT `TaskAssignee_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskAssignee` ADD CONSTRAINT `TaskAssignee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Chuyển dữ liệu: mỗi task đang có người thực hiện -> một dòng TaskAssignee.
-- assignedAt lấy theo thời điểm tạo task (không có lịch sử chính xác hơn); an toàn khi chạy lại (INSERT IGNORE theo khóa chính).
INSERT IGNORE INTO `TaskAssignee` (`taskId`, `userId`, `assignedAt`)
SELECT `id`, `assigneeId`, `createdAt`
FROM `Task`
WHERE `assigneeId` IS NOT NULL;

-- Đối chiếu: số dòng đã chép phải bằng số task có người thực hiện, nếu lệch thì dừng migration TRƯỚC khi xóa cột.
-- (MySQL không có RAISE; ép lỗi bằng truy vấn con trả nhiều dòng khi số liệu lệch.)
SELECT IF(
    (SELECT COUNT(*) FROM `TaskAssignee`) >= (SELECT COUNT(*) FROM `Task` WHERE `assigneeId` IS NOT NULL),
    1,
    (SELECT 1 UNION ALL SELECT 2)
) AS `assignee_copy_verified`;

-- DropForeignKey
ALTER TABLE `Task` DROP FOREIGN KEY `Task_assigneeId_fkey`;

-- DropIndex
DROP INDEX `Task_assigneeId_status_idx` ON `Task`;

-- AlterTable
ALTER TABLE `Task` DROP COLUMN `assigneeId`;
