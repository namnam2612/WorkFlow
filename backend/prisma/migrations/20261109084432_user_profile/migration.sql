-- AlterTable
ALTER TABLE `User` ADD COLUMN `bio` VARCHAR(500) NULL,
    ADD COLUMN `contactEmail` VARCHAR(190) NULL,
    ADD COLUMN `facebookUrl` VARCHAR(255) NULL,
    ADD COLUMN `githubUrl` VARCHAR(255) NULL,
    ADD COLUMN `jobTitle` VARCHAR(120) NULL,
    ADD COLUMN `linkedinUrl` VARCHAR(255) NULL,
    ADD COLUMN `phone` VARCHAR(20) NULL;

-- CreateTable
CREATE TABLE `UserAvatar` (
    `userId` INTEGER NOT NULL,
    `mime` VARCHAR(20) NOT NULL,
    `data` MEDIUMBLOB NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserAvatar` ADD CONSTRAINT `UserAvatar_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
