import { boolean, index, int, json, mediumtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  preferredName: varchar("preferredName", { length: 120 }), studyLevel: varchar("studyLevel", { length: 80 }),
  timezone: varchar("timezone", { length: 80 }).default("UTC").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("profiles_user_id_unique").on(table.userId)]);

export const subjects = mysqlTable("subjects", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(), description: text("description"), color: varchar("color", { length: 16 }).default("#4f46e5").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("subjects_user_created_idx").on(table.userId, table.createdAt)]);

export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(), code: varchar("code", { length: 48 }), description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("courses_user_subject_idx").on(table.userId, table.subjectId)]);

export const topics = mysqlTable("topics", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }), courseId: int("courseId").references(() => courses.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(), notes: mediumtext("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("topics_user_subject_idx").on(table.userId, table.subjectId)]);

export const researchBriefs = mysqlTable("researchBriefs", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }), topicId: int("topicId").references(() => topics.id, { onDelete: "set null" }),
  title: varchar("title", { length: 220 }).notNull(), researchQuestion: mediumtext("researchQuestion").notNull(),
  status: mysqlEnum("status", ["draft", "generating", "ready", "failed"]).default("draft").notNull(),
  overview: mediumtext("overview"), keyConcepts: json("keyConcepts"), studyQuestions: json("studyQuestions"), actionPlan: json("actionPlan"), boardContent: json("boardContent"),
  model: varchar("model", { length: 100 }), failureReason: text("failureReason"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("research_briefs_user_updated_idx").on(table.userId, table.updatedAt), index("research_briefs_user_subject_idx").on(table.userId, table.subjectId)]);

export const researchSources = mysqlTable("researchSources", {
  id: int("id").autoincrement().primaryKey(), researchBriefId: int("researchBriefId").notNull().references(() => researchBriefs.id, { onDelete: "cascade" }), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }).notNull(), url: varchar("url", { length: 2048 }), sourceType: mysqlEnum("sourceType", ["user_note", "document", "generated_reference"]).default("generated_reference").notNull(),
  note: mediumtext("note"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("research_sources_brief_idx").on(table.researchBriefId), index("research_sources_user_idx").on(table.userId)]);

export const researchExports = mysqlTable("researchExports", {
  id: int("id").autoincrement().primaryKey(), researchBriefId: int("researchBriefId").notNull().references(() => researchBriefs.id, { onDelete: "cascade" }), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: varchar("fileName", { length: 320 }).notNull(), storageKey: varchar("storageKey", { length: 512 }).notNull().unique(), mimeType: varchar("mimeType", { length: 120 }).notNull(), byteSize: int("byteSize").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("research_exports_user_brief_idx").on(table.userId, table.researchBriefId), index("research_exports_user_created_idx").on(table.userId, table.createdAt)]);

export const studyNotes = mysqlTable("studyNotes", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }), documentId: int("documentId").references(() => documents.id, { onDelete: "set null" }),
  title: varchar("title", { length: 260 }).notNull(), scopeType: mysqlEnum("scopeType", ["topic", "chapter", "section", "range", "document"]).notNull(), scopeLabel: varchar("scopeLabel", { length: 300 }).notNull(),
  content: json("content").notNull(), model: varchar("model", { length: 100 }), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("study_notes_user_updated_idx").on(table.userId, table.updatedAt), index("study_notes_user_document_idx").on(table.userId, table.documentId)]);

export const stickyNotes = mysqlTable("stickyNotes", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), studyNoteId: int("studyNoteId").notNull().references(() => studyNotes.id, { onDelete: "cascade" }),
  content: text("content").notNull(), color: varchar("color", { length: 24 }).default("yellow").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("sticky_notes_user_study_note_idx").on(table.userId, table.studyNoteId)]);

export const revisionGuides = mysqlTable("revisionGuides", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), documentId: int("documentId").references(() => documents.id, { onDelete: "set null" }), subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  title: varchar("title", { length: 260 }).notNull(), scopeLabel: varchar("scopeLabel", { length: 300 }).notNull(), content: json("content").notNull(), model: varchar("model", { length: 100 }), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("revision_guides_user_created_idx").on(table.userId, table.createdAt), index("revision_guides_user_document_idx").on(table.userId, table.documentId)]);

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }), title: varchar("title", { length: 180 }).notNull(),
  learningMode: mysqlEnum("learningMode", ["explain", "teach", "simplify", "examples", "step_by_step", "quiz_me", "practice", "exam_prep"]).default("teach").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("conversations_user_updated_idx").on(table.userId, table.updatedAt)]);

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(), conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: mediumtext("content").notNull(), model: varchar("model", { length: 100 }), generationStatus: mysqlEnum("generationStatus", ["complete", "failed", "cancelled"]).default("complete").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("messages_conversation_created_idx").on(table.conversationId, table.createdAt), index("messages_user_created_idx").on(table.userId, table.createdAt)]);

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }), storageKey: varchar("storageKey", { length: 512 }).notNull().unique(),
  originalName: varchar("originalName", { length: 255 }).notNull(), mimeType: varchar("mimeType", { length: 120 }).notNull(), byteSize: int("byteSize").notNull(),
  status: mysqlEnum("status", ["uploading", "queued", "processing", "ready", "failed", "deleted"]).default("uploading").notNull(), pageCount: int("pageCount"),
  extractedText: mediumtext("extractedText"), extractionFingerprint: varchar("extractionFingerprint", { length: 128 }), failureReason: text("failureReason"), processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("documents_user_status_idx").on(table.userId, table.status), index("documents_user_created_idx").on(table.userId, table.createdAt)]);

export const documentJobs = mysqlTable("documentJobs", {
  id: int("id").autoincrement().primaryKey(), documentId: int("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobType: mysqlEnum("jobType", ["scan", "extract", "chunk", "embed", "index"]).notNull(), status: mysqlEnum("status", ["queued", "running", "complete", "failed"]).default("queued").notNull(),
  attempts: int("attempts").default(0).notNull(), errorMessage: text("errorMessage"), createdAt: timestamp("createdAt").defaultNow().notNull(), completedAt: timestamp("completedAt"),
}, table => [index("document_jobs_document_status_idx").on(table.documentId, table.status)]);

export const documentChunks = mysqlTable("documentChunks", {
  id: int("id").autoincrement().primaryKey(), documentId: int("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  chunkIndex: int("chunkIndex").notNull(), content: mediumtext("content").notNull(), pageStart: int("pageStart"), pageEnd: int("pageEnd"), sectionLabel: varchar("sectionLabel", { length: 255 }),
  tokenCount: int("tokenCount").notNull(), contentHash: varchar("contentHash", { length: 128 }).notNull(), embedding: json("embedding"), embeddingModel: varchar("embeddingModel", { length: 100 }), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("document_chunks_document_index_unique").on(table.documentId, table.chunkIndex), index("document_chunks_user_document_idx").on(table.userId, table.documentId)]);

export const messageSources = mysqlTable("messageSources", {
  id: int("id").autoincrement().primaryKey(), messageId: int("messageId").notNull().references(() => messages.id, { onDelete: "cascade" }),
  documentId: int("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }), documentChunkId: int("documentChunkId").references(() => documentChunks.id, { onDelete: "set null" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), citationLabel: varchar("citationLabel", { length: 255 }).notNull(), pageStart: int("pageStart"), pageEnd: int("pageEnd"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("message_sources_message_idx").on(table.messageId), index("message_sources_user_document_idx").on(table.userId, table.documentId)]);

export const quizzes = mysqlTable("quizzes", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }), documentId: int("documentId").references(() => documents.id, { onDelete: "set null" }), title: varchar("title", { length: 200 }).notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium").notNull(), sourceType: mysqlEnum("sourceType", ["topic", "document", "conversation"]).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("quizzes_user_created_idx").on(table.userId, table.createdAt)]);

export const quizQuestions = mysqlTable("quizQuestions", {
  id: int("id").autoincrement().primaryKey(), quizId: int("quizId").notNull().references(() => quizzes.id, { onDelete: "cascade" }), position: int("position").notNull(),
  questionType: mysqlEnum("questionType", ["multiple_choice", "true_false", "short_answer"]).notNull(), prompt: mediumtext("prompt").notNull(), options: json("options"), correctAnswer: mediumtext("correctAnswer").notNull(), explanation: mediumtext("explanation").notNull(),
}, table => [uniqueIndex("quiz_questions_quiz_position_unique").on(table.quizId, table.position)]);

export const quizAttempts = mysqlTable("quizAttempts", {
  id: int("id").autoincrement().primaryKey(), quizId: int("quizId").notNull().references(() => quizzes.id, { onDelete: "cascade" }), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  score: int("score").notNull(), totalQuestions: int("totalQuestions").notNull(), completedAt: timestamp("completedAt").defaultNow().notNull(),
}, table => [index("quiz_attempts_user_completed_idx").on(table.userId, table.completedAt)]);

export const attemptAnswers = mysqlTable("attemptAnswers", {
  id: int("id").autoincrement().primaryKey(), attemptId: int("attemptId").notNull().references(() => quizAttempts.id, { onDelete: "cascade" }), questionId: int("questionId").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }), answer: mediumtext("answer").notNull(), isCorrect: boolean("isCorrect").notNull(),
}, table => [uniqueIndex("attempt_answers_attempt_question_unique").on(table.attemptId, table.questionId)]);

export const flashcards = mysqlTable("flashcards", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }), documentId: int("documentId").references(() => documents.id, { onDelete: "set null" }),
  front: mediumtext("front").notNull(), back: mediumtext("back").notNull(), sourceType: mysqlEnum("sourceType", ["topic", "document", "conversation"]).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("flashcards_user_created_idx").on(table.userId, table.createdAt)]);

export const flashcardReviews = mysqlTable("flashcardReviews", {
  id: int("id").autoincrement().primaryKey(), flashcardId: int("flashcardId").notNull().references(() => flashcards.id, { onDelete: "cascade" }), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), outcome: mysqlEnum("outcome", ["again", "hard", "good", "easy"]).notNull(), reviewedAt: timestamp("reviewedAt").defaultNow().notNull(),
}, table => [index("flashcard_reviews_user_reviewed_idx").on(table.userId, table.reviewedAt)]);

export const studyPlans = mysqlTable("studyPlans", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  title: varchar("title", { length: 200 }).notNull(), examDate: timestamp("examDate"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("study_plans_user_exam_idx").on(table.userId, table.examDate)]);

export const studyPlanItems = mysqlTable("studyPlanItems", {
  id: int("id").autoincrement().primaryKey(), planId: int("planId").notNull().references(() => studyPlans.id, { onDelete: "cascade" }), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), title: varchar("title", { length: 255 }).notNull(), notes: text("notes"), scheduledFor: timestamp("scheduledFor"), estimatedMinutes: int("estimatedMinutes").default(30).notNull(), completedAt: timestamp("completedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("study_plan_items_user_schedule_idx").on(table.userId, table.scheduledFor), index("study_plan_items_plan_idx").on(table.planId)]);

export const studySessions = mysqlTable("studySessions", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }), planItemId: int("planItemId").references(() => studyPlanItems.id, { onDelete: "set null" }), startedAt: timestamp("startedAt").notNull(), endedAt: timestamp("endedAt"), minutesStudied: int("minutesStudied").default(0).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("study_sessions_user_started_idx").on(table.userId, table.startedAt)]);

export const progressEvents = mysqlTable("progressEvents", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), eventType: mysqlEnum("eventType", ["subject_created", "topic_created", "session_completed", "quiz_completed", "flashcard_reviewed", "document_ready", "plan_item_completed"]).notNull(), entityType: varchar("entityType", { length: 64 }).notNull(), entityId: int("entityId").notNull(), metadata: json("metadata"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("progress_events_user_created_idx").on(table.userId, table.createdAt)]);

export const usageCounters = mysqlTable("usageCounters", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), periodKey: varchar("periodKey", { length: 16 }).notNull(), chatRequests: int("chatRequests").default(0).notNull(), generatedTokens: int("generatedTokens").default(0).notNull(), uploadBytes: int("uploadBytes").default(0).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("usage_counters_user_period_unique").on(table.userId, table.periodKey)]);

export const aiRequests = mysqlTable("aiRequests", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), feature: mysqlEnum("feature", ["chat", "quiz", "flashcards", "embedding", "document_qa"]).notNull(), model: varchar("model", { length: 100 }), status: mysqlEnum("status", ["started", "complete", "failed", "rate_limited"]).notNull(), promptTokens: int("promptTokens").default(0).notNull(), completionTokens: int("completionTokens").default(0).notNull(), latencyMs: int("latencyMs"), errorCode: varchar("errorCode", { length: 100 }), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("ai_requests_user_feature_created_idx").on(table.userId, table.feature, table.createdAt)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
