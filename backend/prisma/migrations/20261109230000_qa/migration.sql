-- QA: Test case, Test run, Test result (Fail tự sinh Bug)
-- CreateTable
CREATE TABLE `TestCase` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `preconditions` TEXT NULL,
    `steps` TEXT NOT NULL,
    `expected` TEXT NOT NULL,
    `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TestCase_projectId_archived_idx`(`projectId`, `archived`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TestRun` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `environment` ENUM('dev', 'staging', 'prod') NULL,
    `releaseId` INTEGER NULL,
    `status` ENUM('open', 'closed') NOT NULL DEFAULT 'open',
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,

    INDEX `TestRun_projectId_status_idx`(`projectId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TestResult` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `runId` INTEGER NOT NULL,
    `testCaseId` INTEGER NOT NULL,
    `status` ENUM('untested', 'passed', 'failed', 'blocked', 'skipped') NOT NULL DEFAULT 'untested',
    `note` TEXT NULL,
    `executedById` INTEGER NULL,
    `executedAt` DATETIME(3) NULL,
    `bugId` INTEGER NULL,

    INDEX `TestResult_testCaseId_idx`(`testCaseId`),
    INDEX `TestResult_bugId_idx`(`bugId`),
    UNIQUE INDEX `TestResult_runId_testCaseId_key`(`runId`, `testCaseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TestCase` ADD CONSTRAINT `TestCase_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestRun` ADD CONSTRAINT `TestRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestRun` ADD CONSTRAINT `TestRun_releaseId_fkey` FOREIGN KEY (`releaseId`) REFERENCES `Release`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestResult` ADD CONSTRAINT `TestResult_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `TestRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestResult` ADD CONSTRAINT `TestResult_testCaseId_fkey` FOREIGN KEY (`testCaseId`) REFERENCES `TestCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TestResult` ADD CONSTRAINT `TestResult_bugId_fkey` FOREIGN KEY (`bugId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

