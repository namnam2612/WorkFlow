-- Kênh thông báo ngoài hệ thống: email theo người dùng, Slack webhook theo dự án
-- AlterTable
ALTER TABLE `Project` ADD COLUMN `slackWebhookUrl` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `emailNotifications` BOOLEAN NOT NULL DEFAULT false;

