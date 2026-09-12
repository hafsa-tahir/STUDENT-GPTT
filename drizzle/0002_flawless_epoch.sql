CREATE TABLE `researchBriefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int,
	`topicId` int,
	`title` varchar(220) NOT NULL,
	`researchQuestion` mediumtext NOT NULL,
	`status` enum('draft','generating','ready','failed') NOT NULL DEFAULT 'draft',
	`overview` mediumtext,
	`keyConcepts` json,
	`studyQuestions` json,
	`actionPlan` json,
	`model` varchar(100),
	`failureReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `researchBriefs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `researchSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`researchBriefId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(300) NOT NULL,
	`url` varchar(2048),
	`sourceType` enum('user_note','document','generated_reference') NOT NULL DEFAULT 'generated_reference',
	`note` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `researchSources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `researchBriefs` ADD CONSTRAINT `researchBriefs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `researchBriefs` ADD CONSTRAINT `researchBriefs_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `researchBriefs` ADD CONSTRAINT `researchBriefs_topicId_topics_id_fk` FOREIGN KEY (`topicId`) REFERENCES `topics`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `researchSources` ADD CONSTRAINT `researchSources_researchBriefId_researchBriefs_id_fk` FOREIGN KEY (`researchBriefId`) REFERENCES `researchBriefs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `researchSources` ADD CONSTRAINT `researchSources_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `research_briefs_user_updated_idx` ON `researchBriefs` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `research_briefs_user_subject_idx` ON `researchBriefs` (`userId`,`subjectId`);--> statement-breakpoint
CREATE INDEX `research_sources_brief_idx` ON `researchSources` (`researchBriefId`);--> statement-breakpoint
CREATE INDEX `research_sources_user_idx` ON `researchSources` (`userId`);