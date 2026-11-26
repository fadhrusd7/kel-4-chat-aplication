-- Run once on an existing `chat` database before using message deletion.
ALTER TABLE `messages`
  ADD COLUMN `deleted_at` timestamp(3) NULL DEFAULT NULL,
  ADD KEY `idx_messages_deleted_at` (`deleted_at`);
