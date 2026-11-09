-- Cổng khách hàng: liên kết xem roadmap chỉ đọc
-- CreateTable
CREATE TABLE `GuestLink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `tokenPrefix` VARCHAR(8) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastViewedAt` DATETIME(3) NULL,
    `viewCount` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `GuestLink_tokenHash_key`(`tokenHash`),
    INDEX `GuestLink_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GuestLink` ADD CONSTRAINT `GuestLink_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

