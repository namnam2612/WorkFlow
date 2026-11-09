-- Sprint, Epic, ghi nhận thời gian (work log)
-- AlterTable
ALTER TABLE `Task` ADD COLUMN `epicId` INTEGER NULL,
    ADD COLUMN `sprintId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Sprint` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `goal` TEXT NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `status` ENUM('planned', 'active', 'completed') NOT NULL DEFAULT 'planned',
    `committedPoints` INTEGER NULL,
    `completedPoints` INTEGER NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Sprint_projectId_status_idx`(`projectId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `minutes` INTEGER NOT NULL,
    `workedOn` DATETIME(3) NOT NULL,
    `note` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkLog_taskId_idx`(`taskId`),
    INDEX `WorkLog_userId_workedOn_idx`(`userId`, `workedOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Task_sprintId_idx` ON `Task`(`sprintId`);

-- CreateIndex
CREATE INDEX `Task_epicId_idx` ON `Task`(`epicId`);

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_sprintId_fkey` FOREIGN KEY (`sprintId`) REFERENCES `Sprint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_epicId_fkey` FOREIGN KEY (`epicId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sprint` ADD CONSTRAINT `Sprint_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

