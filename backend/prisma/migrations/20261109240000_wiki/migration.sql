-- Wiki/Docs Markdown của dự án, kèm lịch sử chỉnh sửa
-- CreateTable
CREATE TABLE `WikiPage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `parentId` INTEGER NULL,
    `title` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(220) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdById` INTEGER NOT NULL,
    `updatedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WikiPage_projectId_parentId_idx`(`projectId`, `parentId`),
    UNIQUE INDEX `WikiPage_projectId_slug_key`(`projectId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WikiRevision` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pageId` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `authorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WikiRevision_pageId_createdAt_idx`(`pageId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WikiPage` ADD CONSTRAINT `WikiPage_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WikiPage` ADD CONSTRAINT `WikiPage_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `WikiPage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WikiRevision` ADD CONSTRAINT `WikiRevision_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `WikiPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

