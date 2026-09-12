CREATE TABLE `researchExports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`researchBriefId` int NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(320) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`byteSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `researchExports_id` PRIMARY KEY(`id`),
	CONSTRAINT `researchExports_storageKey_unique` UNIQUE(`storageKey`)
);
--> statement-breakpoint
ALTER TABLE `researchExports` ADD CONSTRAINT `researchExports_researchBriefId_researchBriefs_id_fk` FOREIGN KEY (`researchBriefId`) REFERENCES `researchBriefs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `researchExports` ADD CONSTRAINT `researchExports_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `research_exports_user_brief_idx` ON `researchExports` (`userId`,`researchBriefId`);--> statement-breakpoint
CREATE INDEX `research_exports_user_created_idx` ON `researchExports` (`userId`,`createdAt`);