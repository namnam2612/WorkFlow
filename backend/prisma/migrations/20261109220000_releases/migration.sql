-- Release/Version: tag phiên bản, việc phát hành và Bug phát hiện/sửa theo phiên bản
-- AlterTable
ALTER TABLE `Task` ADD COLUMN `fixReleaseId` INTEGER NULL,
    ADD COLUMN `foundReleaseId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Release` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `version` VARCHAR(40) NOT NULL,
    `name` VARCHAR(160) NULL,
    `description` TEXT NULL,
    `status` ENUM('planned', 'released') NOT NULL DEFAULT 'planned',
    `releasedAt` DATETIME(3) NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Release_projectId_status_idx`(`projectId`, `status`),
    UNIQUE INDEX `Release_projectId_version_key`(`projectId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Task_fixReleaseId_idx` ON `Task`(`fixReleaseId`);

-- CreateIndex
CREATE INDEX `Task_foundReleaseId_idx` ON `Task`(`foundReleaseId`);

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_fixReleaseId_fkey` FOREIGN KEY (`fixReleaseId`) REFERENCES `Release`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_foundReleaseId_fkey` FOREIGN KEY (`foundReleaseId`) REFERENCES `Release`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Release` ADD CONSTRAINT `Release_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

