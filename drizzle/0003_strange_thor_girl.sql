CREATE TABLE `revisionGuides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`documentId` int,
	`subjectId` int,
	`title` varchar(260) NOT NULL,
	`scopeLabel` varchar(300) NOT NULL,
	`content` json NOT NULL,
	`model` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revisionGuides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stickyNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`studyNoteId` int NOT NULL,
	`content` text NOT NULL,
	`color` varchar(24) NOT NULL DEFAULT 'yellow',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stickyNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studyNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int,
	`documentId` int,
	`title` varchar(260) NOT NULL,
	`scopeType` enum('topic','chapter','section','range','document') NOT NULL,
	`scopeLabel` varchar(300) NOT NULL,
	`content` json NOT NULL,
	`model` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studyNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `revisionGuides` ADD CONSTRAINT `revisionGuides_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisionGuides` ADD CONSTRAINT `revisionGuides_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisionGuides` ADD CONSTRAINT `revisionGuides_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stickyNotes` ADD CONSTRAINT `stickyNotes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stickyNotes` ADD CONSTRAINT `stickyNotes_studyNoteId_studyNotes_id_fk` FOREIGN KEY (`studyNoteId`) REFERENCES `studyNotes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studyNotes` ADD CONSTRAINT `studyNotes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studyNotes` ADD CONSTRAINT `studyNotes_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studyNotes` ADD CONSTRAINT `studyNotes_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `revision_guides_user_created_idx` ON `revisionGuides` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `revision_guides_user_document_idx` ON `revisionGuides` (`userId`,`documentId`);--> statement-breakpoint
CREATE INDEX `sticky_notes_user_study_note_idx` ON `stickyNotes` (`userId`,`studyNoteId`);--> statement-breakpoint
CREATE INDEX `study_notes_user_updated_idx` ON `studyNotes` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `study_notes_user_document_idx` ON `studyNotes` (`userId`,`documentId`);