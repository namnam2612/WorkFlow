-- Quy tắc tự động hóa theo dự án
-- CreateTable
CREATE TABLE `AutomationRule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `trigger` ENUM('task_created', 'status_changed', 'task_assigned') NOT NULL,
    `conditions` JSON NOT NULL,
    `actions` JSON NOT NULL,
    `runCount` INTEGER NOT NULL DEFAULT 0,
    `lastRunAt` DATETIME(3) NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AutomationRule_projectId_trigger_enabled_idx`(`projectId`, `trigger`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AutomationRule` ADD CONSTRAINT `AutomationRule_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

