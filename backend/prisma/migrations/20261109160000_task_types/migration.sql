-- Loại công việc (task/story/bug/epic), Story Point, thông tin riêng của Bug
-- AlterTable
ALTER TABLE `Task` ADD COLUMN `environment` ENUM('dev', 'staging', 'prod') NULL,
    ADD COLUMN `severity` ENUM('minor', 'major', 'critical', 'blocker') NULL,
    ADD COLUMN `storyPoints` INTEGER NULL,
    ADD COLUMN `type` ENUM('task', 'story', 'bug', 'epic') NOT NULL DEFAULT 'task';

-- CreateIndex
CREATE INDEX `Task_projectId_type_idx` ON `Task`(`projectId`, `type`);

