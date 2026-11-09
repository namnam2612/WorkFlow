-- Trạng thái tùy biến theo dự án: thay enum Task.status bằng bảng ProjectStatus + Task.statusId.
-- Giữ nguyên dữ liệu: mỗi dự án có sẵn 5 trạng thái giống cũ (+ 6 trạng thái cho Bug), task được nối sang trạng thái cùng tên.

-- CreateTable
CREATE TABLE `ProjectStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `scope` ENUM('task', 'bug') NOT NULL DEFAULT 'task',
    `name` VARCHAR(40) NOT NULL,
    `color` VARCHAR(9) NOT NULL,
    `category` ENUM('todo', 'in_progress', 'done') NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectStatus_projectId_scope_position_idx`(`projectId`, `scope`, `position`),
    UNIQUE INDEX `ProjectStatus_projectId_scope_name_key`(`projectId`, `scope`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProjectStatus` ADD CONSTRAINT `ProjectStatus_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Bộ trạng thái mặc định cho mọi dự án hiện có (thứ tự giống enum cũ: todo, in_progress, review, done, blocked)
INSERT INTO `ProjectStatus` (`projectId`, `scope`, `name`, `color`, `category`, `position`)
SELECT p.`id`, 'task', d.`name`, d.`color`, d.`category`, d.`position`
FROM `Project` p
CROSS JOIN (
    SELECT 'Cần làm' AS `name`, '#64748b' AS `color`, 'todo' AS `category`, 0 AS `position`
    UNION ALL SELECT 'Đang làm', '#3b82f6', 'in_progress', 1
    UNION ALL SELECT 'Chờ duyệt', '#f59e0b', 'in_progress', 2
    UNION ALL SELECT 'Hoàn thành', '#10b981', 'done', 3
    UNION ALL SELECT 'Bị chặn', '#ef4444', 'in_progress', 4
) d;

-- Vòng đời riêng của Bug
INSERT INTO `ProjectStatus` (`projectId`, `scope`, `name`, `color`, `category`, `position`)
SELECT p.`id`, 'bug', d.`name`, d.`color`, d.`category`, d.`position`
FROM `Project` p
CROSS JOIN (
    SELECT 'Mới' AS `name`, '#64748b' AS `color`, 'todo' AS `category`, 0 AS `position`
    UNION ALL SELECT 'Đã xác nhận', '#f59e0b', 'todo', 1
    UNION ALL SELECT 'Đang sửa', '#3b82f6', 'in_progress', 2
    UNION ALL SELECT 'Chờ kiểm thử', '#8b5cf6', 'in_progress', 3
    UNION ALL SELECT 'Mở lại', '#ef4444', 'in_progress', 4
    UNION ALL SELECT 'Đã đóng', '#10b981', 'done', 5
) d;

-- Nối task sang trạng thái mới (cột tạm cho phép NULL)
ALTER TABLE `Task` ADD COLUMN `statusId` INTEGER NULL;

UPDATE `Task` t
JOIN `ProjectStatus` ps
  ON ps.`projectId` = t.`projectId`
 AND ps.`scope` = 'task'
 AND ps.`name` = CASE t.`status`
        WHEN 'todo' THEN 'Cần làm'
        WHEN 'in_progress' THEN 'Đang làm'
        WHEN 'review' THEN 'Chờ duyệt'
        WHEN 'done' THEN 'Hoàn thành'
        WHEN 'blocked' THEN 'Bị chặn'
    END
SET t.`statusId` = ps.`id`;

-- Chốt: còn task chưa được nối thì lệnh NOT NULL bên dưới sẽ lỗi và migration dừng lại, KHÔNG xóa cột status
ALTER TABLE `Task` MODIFY `statusId` INTEGER NOT NULL;

-- DropIndex / DropColumn
DROP INDEX `Task_projectId_status_position_idx` ON `Task`;
ALTER TABLE `Task` DROP COLUMN `status`;

-- CreateIndex
CREATE INDEX `Task_projectId_statusId_position_idx` ON `Task`(`projectId`, `statusId`, `position`);
CREATE INDEX `Task_statusId_idx` ON `Task`(`statusId`);

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `ProjectStatus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
