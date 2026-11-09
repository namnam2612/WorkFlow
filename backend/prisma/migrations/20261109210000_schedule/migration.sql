-- Ngày bắt đầu và phụ thuộc giữa công việc (Gantt/Calendar)
-- AlterTable
ALTER TABLE `Task` ADD COLUMN `startDate` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `TaskDependency` (
    `taskId` INTEGER NOT NULL,
    `dependsOnId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskDependency_dependsOnId_idx`(`dependsOnId`),
    PRIMARY KEY (`taskId`, `dependsOnId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaskDependency` ADD CONSTRAINT `TaskDependency_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskDependency` ADD CONSTRAINT `TaskDependency_dependsOnId_fkey` FOREIGN KEY (`dependsOnId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

