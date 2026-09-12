CREATE TABLE `aiRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`feature` enum('chat','quiz','flashcards','embedding','document_qa') NOT NULL,
	`model` varchar(100),
	`status` enum('started','complete','failed','rate_limited') NOT NULL,
	`promptTokens` int NOT NULL DEFAULT 0,
	`completionTokens` int NOT NULL DEFAULT 0,
	`latencyMs` int,
	`errorCode` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attemptAnswers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`questionId` int NOT NULL,
	`answer` mediumtext NOT NULL,
	`isCorrect` boolean NOT NULL,
	CONSTRAINT `attemptAnswers_id` PRIMARY KEY(`id`),
	CONSTRAINT `attempt_answers_attempt_question_unique` UNIQUE(`attemptId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int,
	`title` varchar(180) NOT NULL,
	`learningMode` enum('explain','teach','simplify','examples','step_by_step','quiz_me','practice','exam_prep') NOT NULL DEFAULT 'teach',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`code` varchar(48),
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentChunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`userId` int NOT NULL,
	`chunkIndex` int NOT NULL,
	`content` mediumtext NOT NULL,
	`pageStart` int,
	`pageEnd` int,
	`sectionLabel` varchar(255),
	`tokenCount` int NOT NULL,
	`contentHash` varchar(128) NOT NULL,
	`embedding` json,
	`embeddingModel` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documentChunks_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_chunks_document_index_unique` UNIQUE(`documentId`,`chunkIndex`)
);
--> statement-breakpoint
CREATE TABLE `documentJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`userId` int NOT NULL,
	`jobType` enum('scan','extract','chunk','embed','index') NOT NULL,
	`status` enum('queued','running','complete','failed') NOT NULL DEFAULT 'queued',
	`attempts` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `documentJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int,
	`storageKey` varchar(512) NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`byteSize` int NOT NULL,
	`status` enum('uploading','queued','processing','ready','failed','deleted') NOT NULL DEFAULT 'uploading',
	`pageCount` int,
	`extractedText` mediumtext,
	`extractionFingerprint` varchar(128),
	`failureReason` text,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `documents_storageKey_unique` UNIQUE(`storageKey`)
);
--> statement-breakpoint
CREATE TABLE `flashcardReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`flashcardId` int NOT NULL,
	`userId` int NOT NULL,
	`outcome` enum('again','hard','good','easy') NOT NULL,
	`reviewedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `flashcardReviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flashcards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int,
	`documentId` int,
	`front` mediumtext NOT NULL,
	`back` mediumtext NOT NULL,
	`sourceType` enum('topic','document','conversation') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `flashcards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messageSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`documentId` int NOT NULL,
	`documentChunkId` int,
	`userId` int NOT NULL,
	`citationLabel` varchar(255) NOT NULL,
	`pageStart` int,
	`pageEnd` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messageSources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` mediumtext NOT NULL,
	`model` varchar(100),
	`generationStatus` enum('complete','failed','cancelled') NOT NULL DEFAULT 'complete',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`preferredName` varchar(120),
	`studyLevel` varchar(80),
	`timezone` varchar(80) NOT NULL DEFAULT 'UTC',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `profiles_user_id_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `progressEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventType` enum('subject_created','topic_created','session_completed','quiz_completed','flashcard_reviewed','document_ready','plan_item_completed') NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `progressEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quizId` int NOT NULL,
	`userId` int NOT NULL,
	`score` int NOT NULL,
	`totalQuestions` int NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quizId` int NOT NULL,
	`position` int NOT NULL,
	`questionType` enum('multiple_choice','true_false','short_answer') NOT NULL,
	`prompt` mediumtext NOT NULL,
	`options` json,
	`correctAnswer` mediumtext NOT NULL,
	`explanation` mediumtext NOT NULL,
	CONSTRAINT `quizQuestions_id` PRIMARY KEY(`id`),
	CONSTRAINT `quiz_questions_quiz_position_unique` UNIQUE(`quizId`,`position`)
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int,
	`documentId` int,
	`title` varchar(200) NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`sourceType` enum('topic','document','conversation') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizzes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studyPlanItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`notes` text,
	`scheduledFor` timestamp,
	`estimatedMinutes` int NOT NULL DEFAULT 30,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `studyPlanItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studyPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int,
	`title` varchar(200) NOT NULL,
	`examDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studyPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studySessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int,
	`planItemId` int,
	`startedAt` timestamp NOT NULL,
	`endedAt` timestamp,
	`minutesStudied` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `studySessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`color` varchar(16) NOT NULL DEFAULT '#4f46e5',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int NOT NULL,
	`courseId` int,
	`name` varchar(160) NOT NULL,
	`notes` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `topics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usageCounters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`periodKey` varchar(16) NOT NULL,
	`chatRequests` int NOT NULL DEFAULT 0,
	`generatedTokens` int NOT NULL DEFAULT 0,
	`uploadBytes` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `usageCounters_id` PRIMARY KEY(`id`),
	CONSTRAINT `usage_counters_user_period_unique` UNIQUE(`userId`,`periodKey`)
);
--> statement-breakpoint
ALTER TABLE `aiRequests` ADD CONSTRAINT `aiRequests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attemptAnswers` ADD CONSTRAINT `attemptAnswers_attemptId_quizAttempts_id_fk` FOREIGN KEY (`attemptId`) REFERENCES `quizAttempts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attemptAnswers` ADD CONSTRAINT `attemptAnswers_questionId_quizQuestions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `quizQuestions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentChunks` ADD CONSTRAINT `documentChunks_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentChunks` ADD CONSTRAINT `documentChunks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentJobs` ADD CONSTRAINT `documentJobs_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documentJobs` ADD CONSTRAINT `documentJobs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `flashcardReviews` ADD CONSTRAINT `flashcardReviews_flashcardId_flashcards_id_fk` FOREIGN KEY (`flashcardId`) REFERENCES `flashcards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `flashcardReviews` ADD CONSTRAINT `flashcardReviews_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `flashcards` ADD CONSTRAINT `flashcards_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `flashcards` ADD CONSTRAINT `flashcards_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `flashcards` ADD CONSTRAINT `flashcards_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messageSources` ADD CONSTRAINT `messageSources_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messageSources` ADD CONSTRAINT `messageSources_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messageSources` ADD CONSTRAINT `messageSources_documentChunkId_documentChunks_id_fk` FOREIGN KEY (`documentChunkId`) REFERENCES `documentChunks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messageSources` ADD CONSTRAINT `messageSources_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `progressEvents` ADD CONSTRAINT `progressEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizAttempts` ADD CONSTRAINT `quizAttempts_quizId_quizzes_id_fk` FOREIGN KEY (`quizId`) REFERENCES `quizzes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizAttempts` ADD CONSTRAINT `quizAttempts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizQuestions` ADD CONSTRAINT `quizQuestions_quizId_quizzes_id_fk` FOREIGN KEY (`quizId`) REFERENCES `quizzes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studyPlanItems` ADD CONSTRAINT `studyPlanItems_planId_studyPlans_id_fk` FOREIGN KEY (`planId`) REFERENCES `studyPlans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studyPlanItems` ADD CONSTRAINT `studyPlanItems_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studyPlans` ADD CONSTRAINT `studyPlans_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studyPlans` ADD CONSTRAINT `studyPlans_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studySessions` ADD CONSTRAINT `studySessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studySessions` ADD CONSTRAINT `studySessions_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studySessions` ADD CONSTRAINT `studySessions_planItemId_studyPlanItems_id_fk` FOREIGN KEY (`planItemId`) REFERENCES `studyPlanItems`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `topics` ADD CONSTRAINT `topics_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `topics` ADD CONSTRAINT `topics_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `topics` ADD CONSTRAINT `topics_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usageCounters` ADD CONSTRAINT `usageCounters_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_requests_user_feature_created_idx` ON `aiRequests` (`userId`,`feature`,`createdAt`);--> statement-breakpoint
CREATE INDEX `conversations_user_updated_idx` ON `conversations` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `courses_user_subject_idx` ON `courses` (`userId`,`subjectId`);--> statement-breakpoint
CREATE INDEX `document_chunks_user_document_idx` ON `documentChunks` (`userId`,`documentId`);--> statement-breakpoint
CREATE INDEX `document_jobs_document_status_idx` ON `documentJobs` (`documentId`,`status`);--> statement-breakpoint
CREATE INDEX `documents_user_status_idx` ON `documents` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `documents_user_created_idx` ON `documents` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `flashcard_reviews_user_reviewed_idx` ON `flashcardReviews` (`userId`,`reviewedAt`);--> statement-breakpoint
CREATE INDEX `flashcards_user_created_idx` ON `flashcards` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `message_sources_message_idx` ON `messageSources` (`messageId`);--> statement-breakpoint
CREATE INDEX `message_sources_user_document_idx` ON `messageSources` (`userId`,`documentId`);--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `messages_user_created_idx` ON `messages` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `progress_events_user_created_idx` ON `progressEvents` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `quiz_attempts_user_completed_idx` ON `quizAttempts` (`userId`,`completedAt`);--> statement-breakpoint
CREATE INDEX `quizzes_user_created_idx` ON `quizzes` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `study_plan_items_user_schedule_idx` ON `studyPlanItems` (`userId`,`scheduledFor`);--> statement-breakpoint
CREATE INDEX `study_plan_items_plan_idx` ON `studyPlanItems` (`planId`);--> statement-breakpoint
CREATE INDEX `study_plans_user_exam_idx` ON `studyPlans` (`userId`,`examDate`);--> statement-breakpoint
CREATE INDEX `study_sessions_user_started_idx` ON `studySessions` (`userId`,`startedAt`);--> statement-breakpoint
CREATE INDEX `subjects_user_created_idx` ON `subjects` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `topics_user_subject_idx` ON `topics` (`userId`,`subjectId`);