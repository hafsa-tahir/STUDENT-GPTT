// server/_core/index.ts
import "dotenv/config";
import { createServer } from "http";
import net from "net";

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
var plugins = [react(), tailwindcss(), jsxLocPlugin()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  envPrefix: ["VITE_", "SUPABASE_"],
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/app.ts
import express2 from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { boolean, index, int, json, mediumtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  preferredName: varchar("preferredName", { length: 120 }),
  studyLevel: varchar("studyLevel", { length: 80 }),
  timezone: varchar("timezone", { length: 80 }).default("UTC").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [uniqueIndex("profiles_user_id_unique").on(table.userId)]);
var subjects = mysqlTable("subjects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 16 }).default("#4f46e5").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("subjects_user_created_idx").on(table.userId, table.createdAt)]);
var courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  code: varchar("code", { length: 48 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("courses_user_subject_idx").on(table.userId, table.subjectId)]);
var topics = mysqlTable("topics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  courseId: int("courseId").references(() => courses.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  notes: mediumtext("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("topics_user_subject_idx").on(table.userId, table.subjectId)]);
var researchBriefs = mysqlTable("researchBriefs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  topicId: int("topicId").references(() => topics.id, { onDelete: "set null" }),
  title: varchar("title", { length: 220 }).notNull(),
  researchQuestion: mediumtext("researchQuestion").notNull(),
  status: mysqlEnum("status", ["draft", "generating", "ready", "failed"]).default("draft").notNull(),
  overview: mediumtext("overview"),
  keyConcepts: json("keyConcepts"),
  studyQuestions: json("studyQuestions"),
  actionPlan: json("actionPlan"),
  boardContent: json("boardContent"),
  model: varchar("model", { length: 100 }),
  failureReason: text("failureReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("research_briefs_user_updated_idx").on(table.userId, table.updatedAt), index("research_briefs_user_subject_idx").on(table.userId, table.subjectId)]);
var researchSources = mysqlTable("researchSources", {
  id: int("id").autoincrement().primaryKey(),
  researchBriefId: int("researchBriefId").notNull().references(() => researchBriefs.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }).notNull(),
  url: varchar("url", { length: 2048 }),
  sourceType: mysqlEnum("sourceType", ["user_note", "document", "generated_reference"]).default("generated_reference").notNull(),
  note: mediumtext("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("research_sources_brief_idx").on(table.researchBriefId), index("research_sources_user_idx").on(table.userId)]);
var researchExports = mysqlTable("researchExports", {
  id: int("id").autoincrement().primaryKey(),
  researchBriefId: int("researchBriefId").notNull().references(() => researchBriefs.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: varchar("fileName", { length: 320 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull().unique(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  byteSize: int("byteSize").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("research_exports_user_brief_idx").on(table.userId, table.researchBriefId), index("research_exports_user_created_idx").on(table.userId, table.createdAt)]);
var studyNotes = mysqlTable("studyNotes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  documentId: int("documentId").references(() => documents.id, { onDelete: "set null" }),
  title: varchar("title", { length: 260 }).notNull(),
  scopeType: mysqlEnum("scopeType", ["topic", "chapter", "section", "range", "document"]).notNull(),
  scopeLabel: varchar("scopeLabel", { length: 300 }).notNull(),
  content: json("content").notNull(),
  model: varchar("model", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("study_notes_user_updated_idx").on(table.userId, table.updatedAt), index("study_notes_user_document_idx").on(table.userId, table.documentId)]);
var stickyNotes = mysqlTable("stickyNotes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  studyNoteId: int("studyNoteId").notNull().references(() => studyNotes.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  color: varchar("color", { length: 24 }).default("yellow").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("sticky_notes_user_study_note_idx").on(table.userId, table.studyNoteId)]);
var revisionGuides = mysqlTable("revisionGuides", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentId: int("documentId").references(() => documents.id, { onDelete: "set null" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  title: varchar("title", { length: 260 }).notNull(),
  scopeLabel: varchar("scopeLabel", { length: 300 }).notNull(),
  content: json("content").notNull(),
  model: varchar("model", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("revision_guides_user_created_idx").on(table.userId, table.createdAt), index("revision_guides_user_document_idx").on(table.userId, table.documentId)]);
var conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  title: varchar("title", { length: 180 }).notNull(),
  learningMode: mysqlEnum("learningMode", ["explain", "teach", "simplify", "examples", "step_by_step", "quiz_me", "practice", "exam_prep"]).default("teach").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("conversations_user_updated_idx").on(table.userId, table.updatedAt)]);
var messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: mediumtext("content").notNull(),
  model: varchar("model", { length: 100 }),
  generationStatus: mysqlEnum("generationStatus", ["complete", "failed", "cancelled"]).default("complete").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("messages_conversation_created_idx").on(table.conversationId, table.createdAt), index("messages_user_created_idx").on(table.userId, table.createdAt)]);
var documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  storageKey: varchar("storageKey", { length: 512 }).notNull().unique(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  byteSize: int("byteSize").notNull(),
  status: mysqlEnum("status", ["uploading", "queued", "processing", "ready", "failed", "deleted"]).default("uploading").notNull(),
  pageCount: int("pageCount"),
  extractedText: mediumtext("extractedText"),
  extractionFingerprint: varchar("extractionFingerprint", { length: 128 }),
  failureReason: text("failureReason"),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("documents_user_status_idx").on(table.userId, table.status), index("documents_user_created_idx").on(table.userId, table.createdAt)]);
var documentJobs = mysqlTable("documentJobs", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobType: mysqlEnum("jobType", ["scan", "extract", "chunk", "embed", "index"]).notNull(),
  status: mysqlEnum("status", ["queued", "running", "complete", "failed"]).default("queued").notNull(),
  attempts: int("attempts").default(0).notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt")
}, (table) => [index("document_jobs_document_status_idx").on(table.documentId, table.status)]);
var documentChunks = mysqlTable("documentChunks", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  chunkIndex: int("chunkIndex").notNull(),
  content: mediumtext("content").notNull(),
  pageStart: int("pageStart"),
  pageEnd: int("pageEnd"),
  sectionLabel: varchar("sectionLabel", { length: 255 }),
  tokenCount: int("tokenCount").notNull(),
  contentHash: varchar("contentHash", { length: 128 }).notNull(),
  embedding: json("embedding"),
  embeddingModel: varchar("embeddingModel", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [uniqueIndex("document_chunks_document_index_unique").on(table.documentId, table.chunkIndex), index("document_chunks_user_document_idx").on(table.userId, table.documentId)]);
var messageSources = mysqlTable("messageSources", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull().references(() => messages.id, { onDelete: "cascade" }),
  documentId: int("documentId").notNull().references(() => documents.id, { onDelete: "cascade" }),
  documentChunkId: int("documentChunkId").references(() => documentChunks.id, { onDelete: "set null" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  citationLabel: varchar("citationLabel", { length: 255 }).notNull(),
  pageStart: int("pageStart"),
  pageEnd: int("pageEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("message_sources_message_idx").on(table.messageId), index("message_sources_user_document_idx").on(table.userId, table.documentId)]);
var quizzes = mysqlTable("quizzes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  documentId: int("documentId").references(() => documents.id, { onDelete: "set null" }),
  title: varchar("title", { length: 200 }).notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium").notNull(),
  sourceType: mysqlEnum("sourceType", ["topic", "document", "conversation"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("quizzes_user_created_idx").on(table.userId, table.createdAt)]);
var quizQuestions = mysqlTable("quizQuestions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  position: int("position").notNull(),
  questionType: mysqlEnum("questionType", ["multiple_choice", "true_false", "short_answer"]).notNull(),
  prompt: mediumtext("prompt").notNull(),
  options: json("options"),
  correctAnswer: mediumtext("correctAnswer").notNull(),
  explanation: mediumtext("explanation").notNull()
}, (table) => [uniqueIndex("quiz_questions_quiz_position_unique").on(table.quizId, table.position)]);
var quizAttempts = mysqlTable("quizAttempts", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  score: int("score").notNull(),
  totalQuestions: int("totalQuestions").notNull(),
  completedAt: timestamp("completedAt").defaultNow().notNull()
}, (table) => [index("quiz_attempts_user_completed_idx").on(table.userId, table.completedAt)]);
var attemptAnswers = mysqlTable("attemptAnswers", {
  id: int("id").autoincrement().primaryKey(),
  attemptId: int("attemptId").notNull().references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: int("questionId").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  answer: mediumtext("answer").notNull(),
  isCorrect: boolean("isCorrect").notNull()
}, (table) => [uniqueIndex("attempt_answers_attempt_question_unique").on(table.attemptId, table.questionId)]);
var flashcards = mysqlTable("flashcards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  documentId: int("documentId").references(() => documents.id, { onDelete: "set null" }),
  front: mediumtext("front").notNull(),
  back: mediumtext("back").notNull(),
  sourceType: mysqlEnum("sourceType", ["topic", "document", "conversation"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("flashcards_user_created_idx").on(table.userId, table.createdAt)]);
var flashcardReviews = mysqlTable("flashcardReviews", {
  id: int("id").autoincrement().primaryKey(),
  flashcardId: int("flashcardId").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  outcome: mysqlEnum("outcome", ["again", "hard", "good", "easy"]).notNull(),
  reviewedAt: timestamp("reviewedAt").defaultNow().notNull()
}, (table) => [index("flashcard_reviews_user_reviewed_idx").on(table.userId, table.reviewedAt)]);
var studyPlans = mysqlTable("studyPlans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  title: varchar("title", { length: 200 }).notNull(),
  examDate: timestamp("examDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("study_plans_user_exam_idx").on(table.userId, table.examDate)]);
var studyPlanItems = mysqlTable("studyPlanItems", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull().references(() => studyPlans.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  notes: text("notes"),
  scheduledFor: timestamp("scheduledFor"),
  estimatedMinutes: int("estimatedMinutes").default(30).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("study_plan_items_user_schedule_idx").on(table.userId, table.scheduledFor), index("study_plan_items_plan_idx").on(table.planId)]);
var studySessions = mysqlTable("studySessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  planItemId: int("planItemId").references(() => studyPlanItems.id, { onDelete: "set null" }),
  startedAt: timestamp("startedAt").notNull(),
  endedAt: timestamp("endedAt"),
  minutesStudied: int("minutesStudied").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("study_sessions_user_started_idx").on(table.userId, table.startedAt)]);
var progressEvents = mysqlTable("progressEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventType: mysqlEnum("eventType", ["subject_created", "topic_created", "session_completed", "quiz_completed", "flashcard_reviewed", "document_ready", "plan_item_completed"]).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("progress_events_user_created_idx").on(table.userId, table.createdAt)]);
var usageCounters = mysqlTable("usageCounters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  periodKey: varchar("periodKey", { length: 16 }).notNull(),
  chatRequests: int("chatRequests").default(0).notNull(),
  generatedTokens: int("generatedTokens").default(0).notNull(),
  uploadBytes: int("uploadBytes").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [uniqueIndex("usage_counters_user_period_unique").on(table.userId, table.periodKey)]);
var aiRequests = mysqlTable("aiRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  feature: mysqlEnum("feature", ["chat", "quiz", "flashcards", "embedding", "document_qa"]).notNull(),
  model: varchar("model", { length: 100 }),
  status: mysqlEnum("status", ["started", "complete", "failed", "rate_limited"]).notNull(),
  promptTokens: int("promptTokens").default(0).notNull(),
  completionTokens: int("completionTokens").default(0).notNull(),
  latencyMs: int("latencyMs"),
  errorCode: varchar("errorCode", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("ai_requests_user_feature_created_idx").on(table.userId, table.feature, table.createdAt)]);

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openrouterApiUrl: process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1",
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openrouterModel: process.env.OPENROUTER_MODEL ?? "google/gemma-4-31b-it:free",
  openrouterFallbackModels: (process.env.OPENROUTER_FALLBACK_MODELS ?? "nvidia/nemotron-3.5-lightning:free,liquid/lfm-2.5-2.6b:free").split(",").map((model) => model.trim()).filter(Boolean),
  groqApiKeys: (process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY ?? "").split(",").map((k) => k.trim()).filter(Boolean),
  geminiApiKeys: (process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY ?? "").split(",").map((k) => k.trim()).filter(Boolean)
};

// server/db.ts
import mysql from "mysql2";
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = process.env.DATABASE_URL;
      const baseUrl = url.split("?")[0];
      const pool = mysql.createPool({
        uri: baseUrl,
        ssl: {
          rejectUnauthorized: true
        }
      });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
    }
  }
  return _db;
}
function requireDb(db) {
  if (!db) throw new Error("The database connection is not available.");
  return db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const now = /* @__PURE__ */ new Date();
  const values = { openId: user.openId, lastSignedIn: now, role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user") };
  const updateSet = { lastSignedIn: now };
  for (const field of ["name", "email", "loginMethod"]) {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function ensureProfile(userId, name) {
  const db = requireDb(await getDb());
  const existing = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(profiles).values({ userId, preferredName: name?.trim() || null, timezone: "UTC" });
  const created = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return created[0];
}
async function updateProfile(userId, input) {
  const db = requireDb(await getDb());
  await ensureProfile(userId);
  await db.update(profiles).set(input).where(eq(profiles.userId, userId));
  const result = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return result[0];
}
async function listSubjects(userId) {
  const db = requireDb(await getDb());
  return db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(desc(subjects.updatedAt));
}
async function createSubject(userId, input) {
  const db = requireDb(await getDb());
  const result = await db.insert(subjects).values({ ...input, userId });
  const id = Number(result[0].insertId);
  await db.insert(progressEvents).values({ userId, eventType: "subject_created", entityType: "subject", entityId: id });
  const created = await db.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.userId, userId))).limit(1);
  return created[0];
}
async function updateSubject(userId, subjectId, input) {
  const db = requireDb(await getDb());
  await db.update(subjects).set(input).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
  const updated = await db.select().from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Subject not found.");
  return updated[0];
}
async function deleteSubject(userId, subjectId) {
  const db = requireDb(await getDb());
  const owned = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId))).limit(1);
  if (!owned[0]) throw new Error("Subject not found.");
  await db.delete(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
}
async function assertOwnedSubject(userId, subjectId) {
  const db = requireDb(await getDb());
  const result = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId))).limit(1);
  if (!result[0]) throw new Error("Subject not found.");
}
async function listCourses(userId, subjectId) {
  const db = requireDb(await getDb());
  const condition = subjectId ? and(eq(courses.userId, userId), eq(courses.subjectId, subjectId)) : eq(courses.userId, userId);
  return db.select().from(courses).where(condition).orderBy(asc(courses.name));
}
async function createCourse(userId, input) {
  await assertOwnedSubject(userId, input.subjectId);
  const db = requireDb(await getDb());
  const result = await db.insert(courses).values({ ...input, userId });
  const id = Number(result[0].insertId);
  const created = await db.select().from(courses).where(and(eq(courses.id, id), eq(courses.userId, userId))).limit(1);
  return created[0];
}
async function updateCourse(userId, courseId, input) {
  const db = requireDb(await getDb());
  await db.update(courses).set(input).where(and(eq(courses.id, courseId), eq(courses.userId, userId)));
  const updated = await db.select().from(courses).where(and(eq(courses.id, courseId), eq(courses.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Course not found.");
  return updated[0];
}
async function deleteCourse(userId, courseId) {
  const db = requireDb(await getDb());
  const owned = await db.select({ id: courses.id }).from(courses).where(and(eq(courses.id, courseId), eq(courses.userId, userId))).limit(1);
  if (!owned[0]) throw new Error("Course not found.");
  await db.delete(courses).where(and(eq(courses.id, courseId), eq(courses.userId, userId)));
}
async function listTopics(userId, subjectId) {
  const db = requireDb(await getDb());
  const condition = subjectId ? and(eq(topics.userId, userId), eq(topics.subjectId, subjectId)) : eq(topics.userId, userId);
  return db.select().from(topics).where(condition).orderBy(desc(topics.updatedAt));
}
async function createTopic(userId, input) {
  await assertOwnedSubject(userId, input.subjectId);
  const db = requireDb(await getDb());
  if (input.courseId) {
    const course = await db.select({ id: courses.id, subjectId: courses.subjectId }).from(courses).where(and(eq(courses.id, input.courseId), eq(courses.userId, userId))).limit(1);
    if (!course[0] || course[0].subjectId !== input.subjectId) throw new Error("Course not found.");
  }
  const result = await db.insert(topics).values({ ...input, userId });
  const id = Number(result[0].insertId);
  await db.insert(progressEvents).values({ userId, eventType: "topic_created", entityType: "topic", entityId: id });
  const created = await db.select().from(topics).where(and(eq(topics.id, id), eq(topics.userId, userId))).limit(1);
  return created[0];
}
async function updateTopic(userId, topicId, input) {
  const db = requireDb(await getDb());
  await db.update(topics).set(input).where(and(eq(topics.id, topicId), eq(topics.userId, userId)));
  const updated = await db.select().from(topics).where(and(eq(topics.id, topicId), eq(topics.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Topic not found.");
  return updated[0];
}
async function deleteTopic(userId, topicId) {
  const db = requireDb(await getDb());
  const owned = await db.select({ id: topics.id }).from(topics).where(and(eq(topics.id, topicId), eq(topics.userId, userId))).limit(1);
  if (!owned[0]) throw new Error("Topic not found.");
  await db.delete(topics).where(and(eq(topics.id, topicId), eq(topics.userId, userId)));
}
async function getDashboardData(userId) {
  const db = requireDb(await getDb());
  const now = /* @__PURE__ */ new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const nextMonth = new Date(now);
  nextMonth.setDate(nextMonth.getDate() + 30);
  const [profile, subjectRows, todayItems, upcomingPlans, activity, recentSessions] = await Promise.all([
    ensureProfile(userId),
    db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(desc(subjects.updatedAt)),
    db.select({ id: studyPlanItems.id, title: studyPlanItems.title, scheduledFor: studyPlanItems.scheduledFor, estimatedMinutes: studyPlanItems.estimatedMinutes, completedAt: studyPlanItems.completedAt, planTitle: studyPlans.title }).from(studyPlanItems).innerJoin(studyPlans, eq(studyPlanItems.planId, studyPlans.id)).where(and(eq(studyPlanItems.userId, userId), gte(studyPlanItems.scheduledFor, start), lte(studyPlanItems.scheduledFor, end))).orderBy(asc(studyPlanItems.scheduledFor)),
    db.select().from(studyPlans).where(and(eq(studyPlans.userId, userId), gte(studyPlans.examDate, now), lte(studyPlans.examDate, nextMonth))).orderBy(asc(studyPlans.examDate)).limit(5),
    db.select().from(progressEvents).where(eq(progressEvents.userId, userId)).orderBy(desc(progressEvents.createdAt)).limit(6),
    db.select().from(studySessions).where(eq(studySessions.userId, userId)).orderBy(desc(studySessions.startedAt)).limit(10)
  ]);
  const sessionMinutesToday = recentSessions.filter((session) => session.startedAt >= start && session.startedAt <= end).reduce((total, session) => total + session.minutesStudied, 0);
  return { profile, subjects: subjectRows, todayItems, upcomingPlans, activity, recentSessions, sessionMinutesToday };
}
async function listStudyPlans(userId) {
  const db = requireDb(await getDb());
  const plans = await db.select().from(studyPlans).where(eq(studyPlans.userId, userId)).orderBy(asc(studyPlans.examDate));
  const items = await db.select().from(studyPlanItems).where(eq(studyPlanItems.userId, userId)).orderBy(asc(studyPlanItems.scheduledFor));
  const sessions = await db.select().from(studySessions).where(eq(studySessions.userId, userId)).orderBy(desc(studySessions.startedAt)).limit(20);
  return plans.map((plan) => ({ ...plan, items: items.filter((item) => item.planId === plan.id), sessions: sessions.filter((session) => session.planItemId && items.some((item) => item.id === session.planItemId && item.planId === plan.id)) }));
}
async function createStudyPlan(userId, input) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  const db = requireDb(await getDb());
  const result = await db.insert(studyPlans).values({ ...input, userId });
  const id = Number(result[0].insertId);
  const created = await db.select().from(studyPlans).where(and(eq(studyPlans.id, id), eq(studyPlans.userId, userId))).limit(1);
  return created[0];
}
async function updateStudyPlan(userId, planId, input) {
  const db = requireDb(await getDb());
  await db.update(studyPlans).set(input).where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId)));
  const updated = await db.select().from(studyPlans).where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Study plan not found.");
  return updated[0];
}
async function deleteStudyPlan(userId, planId) {
  const db = requireDb(await getDb());
  const owned = await db.select({ id: studyPlans.id }).from(studyPlans).where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId))).limit(1);
  if (!owned[0]) throw new Error("Study plan not found.");
  await db.delete(studyPlans).where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId)));
}
async function createStudyPlanItem(userId, input) {
  const db = requireDb(await getDb());
  const plan = await db.select({ id: studyPlans.id }).from(studyPlans).where(and(eq(studyPlans.id, input.planId), eq(studyPlans.userId, userId))).limit(1);
  if (!plan[0]) throw new Error("Study plan not found.");
  const result = await db.insert(studyPlanItems).values({ ...input, userId });
  const id = Number(result[0].insertId);
  const created = await db.select().from(studyPlanItems).where(and(eq(studyPlanItems.id, id), eq(studyPlanItems.userId, userId))).limit(1);
  return created[0];
}
async function updateStudyPlanItem(userId, itemId, input) {
  const db = requireDb(await getDb());
  await db.update(studyPlanItems).set(input).where(and(eq(studyPlanItems.id, itemId), eq(studyPlanItems.userId, userId)));
  const updated = await db.select().from(studyPlanItems).where(and(eq(studyPlanItems.id, itemId), eq(studyPlanItems.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Study plan item not found.");
  return updated[0];
}
async function toggleStudyPlanItem(userId, itemId, completed) {
  const db = requireDb(await getDb());
  await db.update(studyPlanItems).set({ completedAt: completed ? /* @__PURE__ */ new Date() : null }).where(and(eq(studyPlanItems.id, itemId), eq(studyPlanItems.userId, userId)));
  const updated = await db.select().from(studyPlanItems).where(and(eq(studyPlanItems.id, itemId), eq(studyPlanItems.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Study plan item not found.");
  if (completed) await db.insert(progressEvents).values({ userId, eventType: "plan_item_completed", entityType: "study_plan_item", entityId: itemId });
  return updated[0];
}
async function createStudySession(userId, input) {
  const db = requireDb(await getDb());
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  if (input.planItemId) {
    const item = await db.select({ id: studyPlanItems.id }).from(studyPlanItems).where(and(eq(studyPlanItems.id, input.planItemId), eq(studyPlanItems.userId, userId))).limit(1);
    if (!item[0]) throw new Error("Study plan item not found.");
  }
  const result = await db.insert(studySessions).values({ ...input, userId });
  const id = Number(result[0].insertId);
  await db.insert(progressEvents).values({ userId, eventType: "session_completed", entityType: "study_session", entityId: id, metadata: { minutesStudied: input.minutesStudied } });
  const created = await db.select().from(studySessions).where(and(eq(studySessions.id, id), eq(studySessions.userId, userId))).limit(1);
  return created[0];
}
async function updateStudySession(userId, sessionId, input) {
  const db = requireDb(await getDb());
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  if (input.planItemId) {
    const item = await db.select({ id: studyPlanItems.id }).from(studyPlanItems).where(and(eq(studyPlanItems.id, input.planItemId), eq(studyPlanItems.userId, userId))).limit(1);
    if (!item[0]) throw new Error("Study plan item not found.");
  }
  await db.update(studySessions).set(input).where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)));
  const updated = await db.select().from(studySessions).where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Study session not found.");
  return updated[0];
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
import fs2 from "node:fs";
import path3 from "node:path";
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      const filePath = path3.resolve(process.cwd(), "uploads", key);
      if (fs2.existsSync(filePath)) {
        res.sendFile(filePath);
        return;
      }
      res.status(404).send("File not found");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const filePath = path3.resolve(process.cwd(), "uploads", key);
        if (fs2.existsSync(filePath)) {
          res.sendFile(filePath);
          return;
        }
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      const filePath = path3.resolve(process.cwd(), "uploads", key);
      if (fs2.existsSync(filePath)) {
        res.sendFile(filePath);
        return;
      }
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z3 } from "zod";

// server/chatService.ts
import { and as and2, asc as asc2, desc as desc2, eq as eq2 } from "drizzle-orm";

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content2 = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content: content2
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var hasOpenRouter = () => ENV.openrouterApiKey.trim().length > 0;
var resolveApiUrl = () => {
  if (hasOpenRouter()) {
    return `${ENV.openrouterApiUrl.replace(/\/$/, "")}/chat/completions`;
  }
  return ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
};
var resolveApiKey = () => hasOpenRouter() ? ENV.openrouterApiKey : ENV.forgeApiKey;
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
var RETRY_MAX_RETRIES = 4;
var RETRY_BASE_DELAY_MS = 500;
var RETRY_MAX_DELAY_MS = 3e4;
var shouldRetryProviderStatus = (status) => status === 408 || status === 409 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
var openRouterModelCandidates = (requestedModel) => {
  if (!hasOpenRouter()) return requestedModel ? [requestedModel] : [void 0];
  const candidates = requestedModel ? [requestedModel] : [ENV.openrouterModel, ...ENV.openrouterFallbackModels];
  return Array.from(new Set(candidates.filter(Boolean)));
};
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var parseRetryAfter = (value) => {
  if (!value) return void 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
  const at = Date.parse(value);
  return Number.isNaN(at) ? void 0 : Math.max(0, at - Date.now());
};
var computeBackoffDelay = (attempt, retryAfterMs) => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};
var fetchWithBackoff = async (url, init, retryProviderErrors = true) => {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES || !retryProviderErrors || !shouldRetryProviderStatus(response.status)) {
        return response;
      }
      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed after exhausting retries");
};
function getProviderCandidates(requestedModel) {
  const candidates = [];
  if (ENV.groqApiKeys.length > 0) {
    for (let index2 = 0; index2 < ENV.groqApiKeys.length; index2++) {
      const key = ENV.groqApiKeys[index2];
      candidates.push({
        name: `Groq (Key #${index2 + 1} - openai/gpt-oss-120b)`,
        url: "https://api.groq.com/openai/v1/chat/completions",
        key,
        model: "openai/gpt-oss-120b"
      });
      candidates.push({
        name: `Groq (Key #${index2 + 1} - openai/gpt-oss-20b)`,
        url: "https://api.groq.com/openai/v1/chat/completions",
        key,
        model: "openai/gpt-oss-20b"
      });
    }
  }
  if (ENV.geminiApiKeys.length > 0) {
    for (let index2 = 0; index2 < ENV.geminiApiKeys.length; index2++) {
      const key = ENV.geminiApiKeys[index2];
      candidates.push({
        name: `Gemini (Key #${index2 + 1} - gemini-3.6-flash)`,
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        key,
        model: "gemini-3.6-flash"
      });
      candidates.push({
        name: `Gemini (Key #${index2 + 1} - gemini-flash-latest)`,
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        key,
        model: "gemini-flash-latest"
      });
    }
  }
  if (ENV.openrouterApiKey) {
    const models = openRouterModelCandidates(requestedModel);
    for (const m of models) {
      if (m) {
        candidates.push({
          name: `OpenRouter (${m})`,
          url: resolveApiUrl(),
          key: ENV.openrouterApiKey,
          model: m
        });
      }
    }
  }
  if (candidates.length === 0 && ENV.forgeApiKey) {
    candidates.push({
      name: "Manus Forge",
      url: resolveApiUrl(),
      key: ENV.forgeApiKey,
      model: requestedModel || "gpt-4o"
    });
  }
  return candidates;
}
var assertApiKey = () => {
  const candidates = getProviderCandidates();
  if (candidates.length === 0) {
    throw new Error("No LLM API keys configured. Please add OPENROUTER_API_KEY, GROQ_API_KEYS, or GEMINI_API_KEYS to .env.");
  }
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages: messages2,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens
  } = params;
  const payload = {
    messages: messages2.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }
  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const candidates = getProviderCandidates(model);
  let lastError = "LLM invoke failed";
  for (const candidate of candidates) {
    payload.model = candidate.model;
    try {
      const response = await fetchWithBackoff(
        candidate.url,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${candidate.key}`
          },
          body: JSON.stringify(payload)
        },
        true
      );
      if (response.ok) return await response.json();
      const errorText = await response.text();
      lastError = `[${candidate.name}] failed: ${response.status} ${response.statusText} \u2013 ${errorText}`;
      console.warn(`Provider ${candidate.name} failed with ${response.status}; trying next provider candidate...`);
    } catch (err) {
      lastError = `[${candidate.name}] error: ${err.message}`;
      console.warn(`Provider ${candidate.name} encountered error; trying next candidate...`);
    }
  }
  throw new Error(lastError);
}
async function streamLLM(params) {
  assertApiKey();
  const payload = {
    messages: params.messages.map(normalizeMessage),
    stream: true
  };
  if (params.max_tokens ?? params.maxTokens) payload.max_tokens = params.max_tokens ?? params.maxTokens;
  if (params.tools?.length) payload.tools = params.tools;
  const normalizedToolChoice = normalizeToolChoice(params.toolChoice || params.tool_choice, params.tools);
  if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;
  const candidates = getProviderCandidates(params.model);
  let lastError = "LLM stream failed";
  for (const candidate of candidates) {
    payload.model = candidate.model;
    try {
      const response = await fetchWithBackoff(
        candidate.url,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${candidate.key}`
          },
          body: JSON.stringify(payload)
        },
        true
      );
      if (response.ok) return response;
      const errorText = await response.text();
      lastError = `[${candidate.name}] stream failed: ${response.status} ${response.statusText} \u2013 ${errorText}`;
      console.warn(`Stream provider ${candidate.name} failed with ${response.status}; trying next provider candidate...`);
    } catch (err) {
      lastError = `[${candidate.name}] stream error: ${err.message}`;
      console.warn(`Stream provider ${candidate.name} error; trying next candidate...`);
    }
  }
  throw new Error(lastError);
}
async function listLLMModels() {
  assertApiKey();
  const url = hasOpenRouter() ? `${ENV.openrouterApiUrl.replace(/\/$/, "")}/models` : ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/models` : "https://forge.manus.im/v1/models";
  const response = await fetchWithBackoff(url, {
    headers: {
      authorization: `Bearer ${resolveApiKey()}`
    }
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `List LLM models failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}
function repairTruncatedJSON(jsonStr) {
  let str = jsonStr.trim();
  if (!str.startsWith("{") && !str.startsWith("[")) return null;
  let inString = false;
  let isEscaped = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "\\" && !isEscaped) {
      isEscaped = true;
    } else {
      if (char === '"' && !isEscaped) {
        inString = !inString;
      }
      isEscaped = false;
    }
  }
  if (inString) {
    str += '"';
  }
  str = str.replace(/,\s*$/, "");
  str = str.replace(/:\s*$/, ': ""');
  str = str.replace(/,\s*("[^"]*")?\s*$/, "");
  const stack = [];
  inString = false;
  isEscaped = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "\\" && !isEscaped) {
      isEscaped = true;
    } else {
      if (char === '"' && !isEscaped) {
        inString = !inString;
      } else if (!inString) {
        if (char === "{" || char === "[") {
          stack.push(char === "{" ? "}" : "]");
        } else if (char === "}" || char === "]") {
          if (stack.length > 0 && stack[stack.length - 1] === char) {
            stack.pop();
          }
        }
      }
      isEscaped = false;
    }
  }
  while (stack.length > 0) {
    str += stack.pop();
  }
  return str;
}
function safeParseJSON(raw, fallback) {
  if (!raw || typeof raw !== "string") {
    if (fallback) return fallback;
    throw new Error("Empty LLM response content");
  }
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
      }
    }
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
      } catch {
      }
    }
    if (firstBrace !== -1) {
      const fragment = cleaned.slice(firstBrace);
      const repaired = repairTruncatedJSON(fragment);
      if (repaired) {
        try {
          return JSON.parse(repaired);
        } catch {
        }
      }
    }
    if (fallback) return fallback;
    throw new Error(`Invalid JSON output from AI provider.`);
  }
}

// server/chatService.ts
var MONTHLY_CHAT_LIMIT = 300;
function requireDatabase(database3) {
  if (!database3) throw new Error("The database connection is not available.");
  return database3;
}
function currentPeriod() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
}
function studentSystemPrompt(mode) {
  const directions = {
    explain: "Explain clearly with short sections, definitions, and one helpful example.",
    teach: "Teach with a scaffolded explanation, checking assumptions before moving to harder detail.",
    simplify: "Use plain language, short sentences, and a concise analogy when useful.",
    examples: "Lead with worked examples, then extract the general method.",
    step_by_step: "Break the answer into numbered reasoning steps without inventing facts.",
    quiz_me: "Use a Socratic style: ask one focused question at a time and wait for the student's answer.",
    practice: "Give practice-oriented guidance, show a method, and leave a small part for the student to attempt.",
    exam_prep: "Prioritize exam-relevant concepts, common mistakes, and a compact recall checklist."
  };
  return `You are StudentGPT, an academically careful learning assistant. ${directions[mode]} Use Markdown when it improves readability. State uncertainty instead of fabricating sources or claims. Never claim to have read a document unless document context was supplied.`;
}
function getText(content2) {
  if (typeof content2 === "string") return content2;
  if (!Array.isArray(content2)) return "";
  return content2.filter((part) => typeof part === "object" && part !== null && "type" in part && "text" in part && part.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
}
async function reserveChatRequest(userId) {
  const db = requireDatabase(await getDb());
  const periodKey = currentPeriod();
  const existing = await db.select().from(usageCounters).where(and2(eq2(usageCounters.userId, userId), eq2(usageCounters.periodKey, periodKey))).limit(1);
  const counter = existing[0];
  if (counter && counter.chatRequests >= MONTHLY_CHAT_LIMIT) {
    await db.insert(aiRequests).values({ userId, feature: "chat", status: "rate_limited", promptTokens: 0, completionTokens: 0, errorCode: "monthly_chat_limit" });
    throw new Error("Your monthly chat allowance has been reached. Please return next month.");
  }
  if (counter) await db.update(usageCounters).set({ chatRequests: counter.chatRequests + 1 }).where(eq2(usageCounters.id, counter.id));
  else await db.insert(usageCounters).values({ userId, periodKey, chatRequests: 1, generatedTokens: 0, uploadBytes: 0 });
  return periodKey;
}
async function listChatConversations(userId) {
  const db = requireDatabase(await getDb());
  return db.select().from(conversations).where(eq2(conversations.userId, userId)).orderBy(desc2(conversations.updatedAt));
}
async function getChatConversation(userId, conversationId) {
  const db = requireDatabase(await getDb());
  const conversation = await db.select().from(conversations).where(and2(eq2(conversations.id, conversationId), eq2(conversations.userId, userId))).limit(1);
  if (!conversation[0]) throw new Error("Conversation not found.");
  const history = await db.select().from(messages).where(and2(eq2(messages.conversationId, conversationId), eq2(messages.userId, userId))).orderBy(asc2(messages.createdAt));
  return { conversation: conversation[0], messages: history };
}
async function createChatConversation(userId, input) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  const db = requireDatabase(await getDb());
  const result = await db.insert(conversations).values({ userId, title: input.title?.trim() || "New study conversation", learningMode: input.learningMode, subjectId: input.subjectId ?? null });
  const id = Number(result[0].insertId);
  const created = await db.select().from(conversations).where(and2(eq2(conversations.id, id), eq2(conversations.userId, userId))).limit(1);
  return created[0];
}
async function retrieveDocumentContext(userId, documentId, query) {
  const db = requireDatabase(await getDb());
  const document = await db.select().from(documents).where(and2(eq2(documents.id, documentId), eq2(documents.userId, userId), eq2(documents.status, "ready"))).limit(1);
  if (!document[0]) throw new Error("Document not found.");
  const chunks = await db.select().from(documentChunks).where(and2(eq2(documentChunks.documentId, documentId), eq2(documentChunks.userId, userId))).limit(250);
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 3).slice(0, 12);
  const ranked = chunks.map((chunk) => ({ chunk, score: terms.reduce((total, term) => total + (chunk.content.toLowerCase().includes(term) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex).slice(0, 6).map((result) => result.chunk);
  return { document: document[0], chunks: ranked };
}
async function sendChatMessage(userId, input) {
  const db = requireDatabase(await getDb());
  const loaded = await getChatConversation(userId, input.conversationId);
  await reserveChatRequest(userId);
  const started = Date.now();
  const requestResult = await db.insert(aiRequests).values({ userId, feature: "chat", status: "started", promptTokens: 0, completionTokens: 0 });
  const requestId = Number(requestResult[0].insertId);
  await db.insert(messages).values({ conversationId: loaded.conversation.id, userId, role: "user", content: input.content, generationStatus: "complete" });
  const history = [...loaded.messages.map((message) => ({ role: message.role, content: message.content })), { role: "user", content: input.content }];
  try {
    const grounding = input.documentId ? await retrieveDocumentContext(userId, input.documentId, input.content) : null;
    const documentInstruction = grounding ? `The student selected the private document \u201C${grounding.document.originalName}\u201D. Answer only using the excerpts below for document-specific claims. Cite the source name in brackets whenever relying on it. If the excerpts do not answer the question, say so.

${grounding.chunks.map((chunk, index2) => `[Excerpt ${index2 + 1}] ${chunk.content}`).join("\n\n")}` : "";
    const result = await invokeLLM({ messages: [{ role: "system", content: studentSystemPrompt(loaded.conversation.learningMode) }, ...documentInstruction ? [{ role: "system", content: documentInstruction }] : [], ...history], maxTokens: 1200 });
    const assistantContent = getText(result.choices[0]?.message.content ?? "I could not generate a response.");
    const assistantResult = await db.insert(messages).values({ conversationId: loaded.conversation.id, userId, role: "assistant", content: assistantContent, model: result.model, generationStatus: "complete" });
    const assistantId = Number(assistantResult[0].insertId);
    if (grounding) {
      for (const chunk of grounding.chunks) await db.insert(messageSources).values({ messageId: assistantId, documentId: grounding.document.id, documentChunkId: chunk.id, userId, citationLabel: grounding.document.originalName, pageStart: chunk.pageStart ?? null, pageEnd: chunk.pageEnd ?? null });
    }
    const usage = result.usage;
    await db.update(aiRequests).set({ status: "complete", model: result.model, promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0, latencyMs: Date.now() - started }).where(eq2(aiRequests.id, requestId));
    if (usage?.completion_tokens) {
      const period = currentPeriod();
      const counter = await db.select().from(usageCounters).where(and2(eq2(usageCounters.userId, userId), eq2(usageCounters.periodKey, period))).limit(1);
      if (counter[0]) await db.update(usageCounters).set({ generatedTokens: counter[0].generatedTokens + usage.completion_tokens }).where(eq2(usageCounters.id, counter[0].id));
    }
    if (loaded.messages.length === 0 && loaded.conversation.title === "New study conversation") {
      await db.update(conversations).set({ title: input.content.slice(0, 72) }).where(and2(eq2(conversations.id, loaded.conversation.id), eq2(conversations.userId, userId)));
    }
    const stored = await db.select().from(messages).where(and2(eq2(messages.id, assistantId), eq2(messages.userId, userId))).limit(1);
    return stored[0];
  } catch (error) {
    await db.update(aiRequests).set({ status: "failed", latencyMs: Date.now() - started, errorCode: "model_request_failed" }).where(eq2(aiRequests.id, requestId));
    throw error;
  }
}
async function regenerateChatMessage(userId, conversationId) {
  const loaded = await getChatConversation(userId, conversationId);
  const lastUser = [...loaded.messages].reverse().find((message) => message.role === "user");
  if (!lastUser) throw new Error("There is no message to regenerate.");
  return sendChatMessage(userId, { conversationId, content: lastUser.content });
}
async function availableChatModels() {
  const catalog = await listLLMModels();
  return catalog.data.map((model) => ({ id: model.id }));
}

// server/documentService.ts
import crypto2 from "node:crypto";
import { and as and3, desc as desc3, eq as eq3 } from "drizzle-orm";
import { PDFParse } from "pdf-parse";

// server/storage.ts
import fs3 from "node:fs";
import path4 from "node:path";
var UPLOADS_DIR = path4.resolve(process.cwd(), "uploads");
function ensureUploadsDir() {
  if (!fs3.existsSync(UPLOADS_DIR)) {
    fs3.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  const key = appendHashSuffix(normalizeKey(relKey));
  if (forgeUrl && forgeKey) {
    const presignUrl = new URL("v1/storage/presign/put", forgeUrl.replace(/\/+$/, "") + "/");
    presignUrl.searchParams.set("path", key);
    const presignResp = await fetch(presignUrl, {
      headers: { Authorization: `Bearer ${forgeKey}` }
    });
    if (presignResp.ok) {
      const { url: s3Url } = await presignResp.json();
      if (s3Url) {
        const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
        const uploadResp = await fetch(s3Url, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob
        });
        if (uploadResp.ok) {
          return { key, url: `/manus-storage/${key}` };
        }
      }
    }
  }
  ensureUploadsDir();
  const filePath = path4.join(UPLOADS_DIR, key);
  fs3.mkdirSync(path4.dirname(filePath), { recursive: true });
  const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  fs3.writeFileSync(filePath, buffer);
  return { key, url: `/manus-storage/${key}` };
}
async function storageGetSignedUrl(relKey) {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  const key = normalizeKey(relKey);
  if (forgeUrl && forgeKey) {
    try {
      const getUrl = new URL("v1/storage/presign/get", forgeUrl.replace(/\/+$/, "") + "/");
      getUrl.searchParams.set("path", key);
      const resp = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${forgeKey}` }
      });
      if (resp.ok) {
        const { url } = await resp.json();
        if (url) return url;
      }
    } catch {
    }
  }
  return `/manus-storage/${key}`;
}

// server/documentService.ts
var MAX_PDF_BYTES = 12 * 1024 * 1024;
function databaseOrThrow(value) {
  if (!value) throw new Error("The database connection is not available.");
  return value;
}
function textChunks(text4, size = 1600, overlap = 250) {
  const clean = text4.replace(/\s+/g, " ").trim();
  const chunks = [];
  for (let start = 0; start < clean.length; start += size - overlap) {
    const chunk = clean.slice(start, start + size).trim();
    if (chunk.length > 80) chunks.push(chunk);
    if (start + size >= clean.length) break;
  }
  return chunks;
}
async function uploadPrivatePdf(userId, file) {
  if (file.mimeType !== "application/pdf") throw new Error("Only PDF files can be uploaded.");
  if (!file.buffer.length || file.buffer.length > MAX_PDF_BYTES) throw new Error("PDF files must be between 1 byte and 12 MB.");
  if (!file.buffer.subarray(0, 4).equals(Buffer.from("%PDF"))) throw new Error("The upload is not a valid PDF file.");
  const db = databaseOrThrow(await getDb());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "study-document.pdf";
  const stored = await storagePut(`private/student-documents/${userId}/${crypto2.randomUUID()}-${safeName}`, file.buffer, "application/pdf");
  const inserted = await db.insert(documents).values({ userId, subjectId: file.subjectId ?? null, storageKey: stored.key, originalName: safeName, mimeType: "application/pdf", byteSize: file.buffer.length, status: "processing" });
  const documentId = Number(inserted[0].insertId);
  const job = await db.insert(documentJobs).values({ documentId, userId, jobType: "extract", status: "running", attempts: 1 });
  const jobId = Number(job[0].insertId);
  try {
    const parser = new PDFParse({ data: file.buffer });
    const result = await parser.getText();
    await parser.destroy();
    const content2 = result.text?.trim() ?? "";
    if (!content2) throw new Error("No selectable text could be extracted from this PDF.");
    const chunks = textChunks(content2);
    for (const [chunkIndex, chunk] of Array.from(chunks.entries())) {
      await db.insert(documentChunks).values({ documentId, userId, chunkIndex, content: chunk, tokenCount: Math.ceil(chunk.length / 4), contentHash: crypto2.createHash("sha256").update(chunk).digest("hex") });
    }
    await db.update(documents).set({ status: "ready", extractedText: content2, pageCount: result.total ?? null, processedAt: /* @__PURE__ */ new Date() }).where(and3(eq3(documents.id, documentId), eq3(documents.userId, userId)));
    await db.update(documentJobs).set({ status: "complete", completedAt: /* @__PURE__ */ new Date() }).where(eq3(documentJobs.id, jobId));
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 1e3) : "Extraction failed.";
    await db.update(documents).set({ status: "failed", failureReason: reason }).where(and3(eq3(documents.id, documentId), eq3(documents.userId, userId)));
    await db.update(documentJobs).set({ status: "failed", errorMessage: reason, completedAt: /* @__PURE__ */ new Date() }).where(eq3(documentJobs.id, jobId));
  }
  const created = await db.select().from(documents).where(and3(eq3(documents.id, documentId), eq3(documents.userId, userId))).limit(1);
  return created[0];
}
async function listPrivateDocuments(userId) {
  const db = databaseOrThrow(await getDb());
  return db.select().from(documents).where(and3(eq3(documents.userId, userId), eq3(documents.status, "ready"))).orderBy(desc3(documents.createdAt));
}
async function getPrivateDocumentDownload(userId, documentId) {
  const db = databaseOrThrow(await getDb());
  const record = await db.select().from(documents).where(and3(eq3(documents.id, documentId), eq3(documents.userId, userId), eq3(documents.status, "ready"))).limit(1);
  if (!record[0]) throw new Error("Document not found.");
  return storageGetSignedUrl(record[0].storageKey);
}

// server/learningArtifactsService.ts
import { and as and4, asc as asc3, eq as eq4 } from "drizzle-orm";
function dbOrThrow(db) {
  if (!db) throw new Error("The database connection is not available.");
  return db;
}
function text2(value) {
  return typeof value === "string" ? value : "";
}
async function studySource(userId, topic, documentId, scopeLabel) {
  const db = dbOrThrow(await getDb());
  if (!documentId) return `Topic: ${topic}`;
  const document = await db.select().from(documents).where(and4(eq4(documents.id, documentId), eq4(documents.userId, userId), eq4(documents.status, "ready"))).limit(1);
  if (!document[0]) throw new Error("Document not found.");
  const chunks = await db.select().from(documentChunks).where(and4(eq4(documentChunks.documentId, documentId), eq4(documentChunks.userId, userId))).limit(18);
  return `Document: ${document[0].originalName}
Requested scope: ${scopeLabel || topic}

${chunks.map((chunk) => chunk.content).join("\n\n").slice(0, 24e3)}`;
}
async function generateQuiz(userId, input) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  const count = input.questionCount ?? 5;
  const scope = input.scopeLabel || input.topic;
  const source = await studySource(userId, input.topic, input.documentId ?? void 0, scope);
  const response = await invokeLLM({
    messages: [{ role: "system", content: "Create academically accurate quiz questions from the supplied study source. Return only valid structured data. Do not invent source claims." }, { role: "user", content: `Difficulty: ${input.difficulty}
Requested ${input.scopeType ?? "topic"}: ${scope}
Create exactly ${count} multiple-choice questions, each with four options, one exact correctAnswer, and a concise explanation.

${source}` }],
    response_format: { type: "json_schema", json_schema: { name: "quiz", strict: true, schema: { type: "object", properties: { questions: { type: "array", minItems: count, maxItems: count, items: { type: "object", properties: { prompt: { type: "string" }, options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } }, correctAnswer: { type: "string" }, explanation: { type: "string" } }, required: ["prompt", "options", "correctAnswer", "explanation"], additionalProperties: false } } }, required: ["questions"], additionalProperties: false } } },
    maxTokens: 1800
  });
  const raw = text2(response.choices[0]?.message.content);
  const generated = safeParseJSON(raw);
  if (!Array.isArray(generated.questions) || generated.questions.length !== count) throw new Error("The quiz generator returned an invalid result. Please try again.");
  const db = dbOrThrow(await getDb());
  const inserted = await db.insert(quizzes).values({ userId, subjectId: input.subjectId ?? null, documentId: input.documentId ?? null, title: input.title, difficulty: input.difficulty, sourceType: input.documentId ? "document" : "topic" });
  const quizId = Number(inserted[0].insertId);
  for (let position = 0; position < generated.questions.length; position++) {
    const question = generated.questions[position];
    await db.insert(quizQuestions).values({ quizId, position, questionType: "multiple_choice", prompt: question.prompt, options: question.options, correctAnswer: question.correctAnswer, explanation: question.explanation });
  }
  return getQuiz(userId, quizId);
}
async function getQuiz(userId, quizId) {
  const db = dbOrThrow(await getDb());
  const quiz = await db.select().from(quizzes).where(and4(eq4(quizzes.id, quizId), eq4(quizzes.userId, userId))).limit(1);
  if (!quiz[0]) throw new Error("Quiz not found.");
  const questions = await db.select().from(quizQuestions).where(eq4(quizQuestions.quizId, quizId)).orderBy(asc3(quizQuestions.position));
  return { quiz: quiz[0], questions };
}
async function submitQuiz(userId, quizId, answers) {
  const loaded = await getQuiz(userId, quizId);
  const db = dbOrThrow(await getDb());
  const map = new Map(answers.map((answer) => [answer.questionId, answer.answer.trim().toLowerCase()]));
  const score = loaded.questions.reduce((total, question) => total + (map.get(question.id) === question.correctAnswer.trim().toLowerCase() ? 1 : 0), 0);
  const inserted = await db.insert(quizAttempts).values({ quizId, userId, score, totalQuestions: loaded.questions.length });
  const attemptId = Number(inserted[0].insertId);
  for (const question of loaded.questions) {
    const answer = map.get(question.id) ?? "";
    await db.insert(attemptAnswers).values({ attemptId, questionId: question.id, answer, isCorrect: answer === question.correctAnswer.trim().toLowerCase() });
  }
  return { score, totalQuestions: loaded.questions.length, questions: loaded.questions };
}
async function generateFlashcards(userId, input) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  const source = await studySource(userId, input.topic, input.documentId ?? void 0, input.scopeLabel || input.topic);
  const response = await invokeLLM({ messages: [{ role: "system", content: "Create concise, high-value academic flashcards from the supplied source. Return only valid structured data." }, { role: "user", content: `Create exactly 8 flashcards with a direct question on the front and a concise correct answer on the back.

${source}` }], response_format: { type: "json_schema", json_schema: { name: "flashcards", strict: true, schema: { type: "object", properties: { cards: { type: "array", minItems: 8, maxItems: 8, items: { type: "object", properties: { front: { type: "string" }, back: { type: "string" } }, required: ["front", "back"], additionalProperties: false } } }, required: ["cards"], additionalProperties: false } } }, maxTokens: 1500 });
  const raw = text2(response.choices[0]?.message.content);
  const generated = safeParseJSON(raw);
  if (!Array.isArray(generated.cards) || generated.cards.length !== 8) throw new Error("The flashcard generator returned an invalid result. Please try again.");
  const db = dbOrThrow(await getDb());
  const created = [];
  for (const card of generated.cards) {
    const result = await db.insert(flashcards).values({ userId, subjectId: input.subjectId ?? null, documentId: input.documentId ?? null, front: card.front, back: card.back, sourceType: input.documentId ? "document" : "topic" });
    const id = Number(result[0].insertId);
    const stored = await db.select().from(flashcards).where(and4(eq4(flashcards.id, id), eq4(flashcards.userId, userId))).limit(1);
    created.push(stored[0]);
  }
  return created;
}
async function listFlashcards(userId) {
  const db = dbOrThrow(await getDb());
  return db.select().from(flashcards).where(eq4(flashcards.userId, userId)).orderBy(asc3(flashcards.createdAt));
}
async function reviewFlashcard(userId, flashcardId, outcome) {
  const db = dbOrThrow(await getDb());
  const card = await db.select({ id: flashcards.id }).from(flashcards).where(and4(eq4(flashcards.id, flashcardId), eq4(flashcards.userId, userId))).limit(1);
  if (!card[0]) throw new Error("Flashcard not found.");
  await db.insert(flashcardReviews).values({ flashcardId, userId, outcome });
  return { success: true };
}
async function listQuizAttemptHistory(userId) {
  const db = dbOrThrow(await getDb());
  return db.select().from(quizAttempts).where(eq4(quizAttempts.userId, userId)).orderBy(asc3(quizAttempts.completedAt));
}
async function listFlashcardReviewHistory(userId) {
  const db = dbOrThrow(await getDb());
  return db.select().from(flashcardReviews).where(eq4(flashcardReviews.userId, userId)).orderBy(asc3(flashcardReviews.reviewedAt));
}

// server/researchService.ts
import { and as and5, desc as desc4, eq as eq5 } from "drizzle-orm";

// server/serpapiService.ts
function isSerpNoResultsError(error) {
  return typeof error === "string" && /hasn't returned any results|no results/i.test(error);
}
function resultSource(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "reddit.com" || host.endsWith(".reddit.com")) return "Reddit";
    if (host === "quora.com" || host.endsWith(".quora.com")) return "Quora";
    return null;
  } catch {
    return null;
  }
}
function normaliseCommunityResults(payload) {
  if (!Array.isArray(payload.organic_results)) return [];
  const seen = /* @__PURE__ */ new Set();
  return payload.organic_results.flatMap((item) => {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const url = typeof item.link === "string" ? item.link.trim() : "";
    const snippet = typeof item.snippet === "string" ? item.snippet.trim() : "";
    const source = resultSource(url);
    if (!title || !url || !source || seen.has(url)) return [];
    seen.add(url);
    return [{ title, url, snippet, source }];
  });
}
async function searchDomain(query, domain, key) {
  const params = new URLSearchParams({ engine: "google", q: `site:${domain} ${query}`, num: "4", api_key: key });
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, { signal: AbortSignal.timeout(14e3) });
  if (!response.ok) throw new Error("Community search is temporarily unavailable.");
  const payload = await response.json();
  if (isSerpNoResultsError(payload.error)) return [];
  if (typeof payload.error === "string") throw new Error("Community search is temporarily unavailable.");
  return normaliseCommunityResults(payload);
}
async function searchCommunityPerspectives(query) {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("Community search is not configured.");
  const responses = await Promise.allSettled([searchDomain(query, "reddit.com", key), searchDomain(query, "quora.com", key)]);
  const available = responses.flatMap((response) => response.status === "fulfilled" ? response.value : []);
  if (available.length === 0 && responses.some((response) => response.status === "rejected")) {
    throw new Error("Community search is temporarily unavailable.");
  }
  return available.slice(0, 8);
}

// server/youtubeService.ts
function normalizedTerms(query) {
  return query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((term) => term.length > 2).slice(0, 10);
}
function relevanceScore(video, terms) {
  const text4 = `${video.title} ${video.description} ${video.channelTitle}`.toLowerCase();
  const title = video.title.toLowerCase();
  return terms.reduce((score, term) => score + (title.includes(term) ? 5 : 0) + (text4.includes(term) ? 2 : 0), 0);
}
async function searchResearchVideos(query) {
  const key = process.env.YOUTUBE_DATA_API_KEY;
  if (!key) throw new Error("YouTube research resources are not configured.");
  const focusedQuery = `${query.trim()} explained lecture tutorial`.slice(0, 240);
  const params = new URLSearchParams({ part: "snippet", type: "video", maxResults: "12", q: focusedQuery, safeSearch: "strict", videoEmbeddable: "true", key });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, { signal: AbortSignal.timeout(1e4) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || "YouTube resource search failed.");
  const terms = normalizedTerms(query);
  return (payload.items ?? []).flatMap((item) => {
    const id = item.id?.videoId;
    const snippet = item.snippet;
    if (!id || !snippet?.title) return [];
    const candidate = { id, title: snippet.title, channelTitle: snippet.channelTitle || "YouTube", description: snippet.description || "", publishedAt: snippet.publishedAt || null, thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || null, url: `https://www.youtube.com/watch?v=${id}` };
    return [{ ...candidate, relevance: `${terms.filter((term) => `${candidate.title} ${candidate.description}`.toLowerCase().includes(term)).slice(0, 3).join(", ") || "topic"} match`, score: relevanceScore(candidate, terms) }];
  }).sort((a, b) => b.score - a.score).slice(0, 6).map(({ score: _score, ...video }) => video);
}

// server/researchService.ts
function database(value) {
  if (!value) throw new Error("The database connection is not available.");
  return value;
}
function content(value) {
  return typeof value === "string" ? value : "";
}
function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function conceptList(value) {
  return Array.isArray(value) ? value.filter((item) => Boolean(item && typeof item === "object" && typeof item.name === "string" && typeof item.explanation === "string")) : [];
}
function boardList(board, key) {
  return board && typeof board === "object" ? stringList(board[key]) : [];
}
function boardText(board, key) {
  return board && typeof board === "object" ? content(board[key]) : "";
}
function exportFileName(title) {
  return `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 180) || "research-brief"}.md`;
}
function createResearchMarkdown(input) {
  const board = input.boardContent;
  const section = (heading, values) => values.length ? ["", `## ${heading}`, ...values.map((value) => `- ${value}`)] : [];
  return [
    "# " + input.title,
    "",
    "## Research question",
    input.researchQuestion,
    "",
    "## Research orientation",
    input.overview || "A synthesis has not been generated yet.",
    ...section("Project focus", boardText(board, "projectFocus") ? [boardText(board, "projectFocus")] : []),
    ...section("Objectives", boardList(board, "objectives")),
    ...section("Methodology and study approach", boardList(board, "methodology")),
    "",
    "## Key concepts",
    ...conceptList(input.keyConcepts).flatMap((concept) => [`- **${concept.name}:** ${concept.explanation}`]),
    ...section("Applications and evidence to seek", boardList(board, "applications")),
    ...section("Common misconceptions", boardList(board, "misconceptions")),
    "",
    "## Questions to pursue",
    ...stringList(input.studyQuestions).map((item, index2) => `${index2 + 1}. ${item}`),
    "",
    "## Study timeline",
    ...stringList(input.actionPlan).map((item, index2) => `${index2 + 1}. ${item}`),
    ...section("Source-verification checklist", boardList(board, "verificationChecklist")),
    "",
    "## Your source desk",
    ...input.sources.flatMap((source) => [`- ${source.title}${source.url ? ` \u2014 ${source.url}` : ""}`, source.note ? `  ${source.note}` : ""]),
    "",
    "## Video resources",
    ...input.videos.map((video) => `- ${video.title} \u2014 ${video.url}${video.relevance ? `
  Relevance: ${video.relevance}` : ""}`),
    "",
    "## Community perspectives",
    "Public Reddit and Quora results are links for further evaluation, not verified evidence.",
    ...input.community.map((item) => `- [${item.source}] ${item.title} \u2014 ${item.url}${item.snippet ? `
  ${item.snippet}` : ""}`),
    "",
    "Generated in StudentGPT. Review original sources before relying on any claim."
  ].join("\n");
}
async function listResearchBriefs(userId) {
  const db = database(await getDb());
  return db.select().from(researchBriefs).where(eq5(researchBriefs.userId, userId)).orderBy(desc4(researchBriefs.updatedAt));
}
async function getResearchBrief(userId, briefId) {
  const db = database(await getDb());
  const brief = await db.select().from(researchBriefs).where(and5(eq5(researchBriefs.id, briefId), eq5(researchBriefs.userId, userId))).limit(1);
  if (!brief[0]) throw new Error("Research brief not found.");
  const sources = await db.select().from(researchSources).where(and5(eq5(researchSources.researchBriefId, briefId), eq5(researchSources.userId, userId))).orderBy(desc4(researchSources.createdAt));
  return { brief: brief[0], sources };
}
async function createResearchBrief(userId, input) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  const db = database(await getDb());
  if (input.topicId) {
    const topic = await db.select({ id: topics.id }).from(topics).where(and5(eq5(topics.id, input.topicId), eq5(topics.userId, userId))).limit(1);
    if (!topic[0]) throw new Error("Topic not found.");
  }
  const result = await db.insert(researchBriefs).values({ userId, title: input.title, researchQuestion: input.researchQuestion, subjectId: input.subjectId ?? null, topicId: input.topicId ?? null });
  return getResearchBrief(userId, Number(result[0].insertId));
}
async function createResearchBriefFromTopic(userId, input) {
  const topic = input.topic.trim();
  return createResearchBrief(userId, { title: topic, researchQuestion: `Develop a detailed student-ready understanding of ${topic}: foundational ideas, important relationships, real applications, misconceptions, evidence worth checking, and a deliberate study sequence.`, subjectId: input.subjectId ?? null });
}
async function addResearchSource(userId, briefId, input) {
  await getResearchBrief(userId, briefId);
  const db = database(await getDb());
  const result = await db.insert(researchSources).values({ userId, researchBriefId: briefId, title: input.title, url: input.url ?? null, note: input.note ?? null, sourceType: "user_note" });
  const stored = await db.select().from(researchSources).where(and5(eq5(researchSources.id, Number(result[0].insertId)), eq5(researchSources.userId, userId))).limit(1);
  return stored[0];
}
async function synthesizeResearchBrief(userId, briefId) {
  const loaded = await getResearchBrief(userId, briefId);
  const db = database(await getDb());
  await db.update(researchBriefs).set({ status: "generating", failureReason: null }).where(and5(eq5(researchBriefs.id, briefId), eq5(researchBriefs.userId, userId)));
  try {
    const sourceNotes = loaded.sources.length ? loaded.sources.map((source) => `Source note: ${source.title}${source.url ? ` (${source.url})` : ""}
${source.note ?? ""}`).join("\n\n") : "No user-provided source notes are available. Provide a clearly labeled general orientation; do not invent citations, statistics, or source-specific claims.";
    const prompt = `Research title: ${loaded.brief.title}
Research question: ${loaded.brief.researchQuestion}

${sourceNotes}

Create a rich, student-ready study project board for "${loaded.brief.title}".
Return ONLY a valid JSON object matching this structure:
{
  "overview": "Comprehensive 3-4 paragraph explanation covering background, principles, real-world context, and key takeaways for ${loaded.brief.title}.",
  "keyConcepts": [
    { "name": "Core Concept 1", "explanation": "Detailed explanation..." },
    { "name": "Core Concept 2", "explanation": "Detailed explanation..." },
    { "name": "Core Concept 3", "explanation": "Detailed explanation..." },
    { "name": "Core Concept 4", "explanation": "Detailed explanation..." }
  ],
  "studyQuestions": [
    "What are the main principles governing ${loaded.brief.title}?",
    "How does this topic apply in real-world engineering or academic scenarios?",
    "What key metrics or standards are used to evaluate performance or quality?"
  ],
  "actionPlan": [
    "Study foundational definitions and theoretical frameworks",
    "Analyze practical implementations and real-world case studies",
    "Perform self-assessment using key study questions"
  ],
  "boardContent": {
    "projectFocus": "Mastering core concepts and practical methodologies of ${loaded.brief.title}",
    "objectives": [
      "Understand foundational theories and operational mechanisms",
      "Evaluate real-world applications and system implementations",
      "Identify common misconceptions and best practices"
    ],
    "methodology": [
      "Literature review and comparative analysis",
      "Practical case study examination and experimentation"
    ],
    "applications": [
      "Academic research and technical problem solving",
      "Industry software and system implementations"
    ],
    "misconceptions": [
      "Assuming simplified models cover all edge cases",
      "Overlooking foundational design trade-offs"
    ],
    "verificationChecklist": [
      "Verify claims against primary documentation and standards"
    ]
  }
}`;
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a top academic AI research assistant. Produce a rich, highly detailed research project board in valid JSON format. Do not include markdown codeblocks or conversational text outside JSON." },
        { role: "user", content: prompt }
      ],
      maxTokens: 3500
    });
    const rawContent = content(response.choices[0]?.message.content);
    const title = loaded.brief.title;
    const parsed = safeParseJSON(rawContent, {});
    const overview = parsed.overview || (rawContent.length > 80 ? rawContent.replace(/```(?:json)?/gi, "").trim() : `Detailed academic research synthesis for ${title}.`);
    const keyConcepts = Array.isArray(parsed.keyConcepts) && parsed.keyConcepts.length ? parsed.keyConcepts : [
      { name: `Foundations of ${title}`, explanation: `Essential theories, definitions, and core principles governing ${title}.` },
      { name: `Architecture & Frameworks`, explanation: `Structural components, workflows, and operational mechanisms.` },
      { name: `Methodology & Best Practices`, explanation: `Standard industry practices, frameworks, and evaluation models.` }
    ];
    const studyQuestions = Array.isArray(parsed.studyQuestions) && parsed.studyQuestions.length ? parsed.studyQuestions : [
      `What are the main principles governing ${title}?`,
      `How are theoretical models applied in real-world scenarios?`,
      `What key standards and best practices guide development in ${title}?`
    ];
    const actionPlan = Array.isArray(parsed.actionPlan) && parsed.actionPlan.length ? parsed.actionPlan : [
      `Review foundational literature and core definitions for ${title}`,
      `Compare key models and real-world implementations`,
      `Complete practical exercises and self-assessment questions`
    ];
    const boardContent = parsed.boardContent && typeof parsed.boardContent === "object" ? parsed.boardContent : {
      projectFocus: `Mastering core concepts and practical methodologies of ${title}`,
      objectives: [
        `Understand foundational theories and operational mechanisms for ${title}`,
        `Evaluate real-world applications and system implementations`,
        `Identify common misconceptions and best practices`
      ],
      methodology: [
        `Literature review and comparative analysis`,
        `Practical case study examination`
      ],
      applications: [
        `Academic research and technical problem solving`,
        `Industry software and system implementations`
      ],
      misconceptions: [
        `Assuming simplified models cover all edge cases`,
        `Overlooking foundational design trade-offs`
      ],
      verificationChecklist: [
        `Verify claims against primary documentation and standards`
      ]
    };
    await db.update(researchBriefs).set({ status: "ready", overview, keyConcepts, studyQuestions, actionPlan, boardContent, model: response.model, failureReason: null }).where(and5(eq5(researchBriefs.id, briefId), eq5(researchBriefs.userId, userId)));
    return getResearchBrief(userId, briefId);
  } catch (error) {
    await db.update(researchBriefs).set({ status: "failed", failureReason: error instanceof Error ? error.message.slice(0, 1e3) : "Research generation failed." }).where(and5(eq5(researchBriefs.id, briefId), eq5(researchBriefs.userId, userId)));
    throw error;
  }
}
async function exportResearchBrief(userId, briefId) {
  const loaded = await getResearchBrief(userId, briefId);
  const query = loaded.brief.title.slice(0, 180);
  const [videosResponse, communityResponse] = await Promise.allSettled([searchResearchVideos(query), searchCommunityPerspectives(query)]);
  const markdown = createResearchMarkdown({ ...loaded.brief, sources: loaded.sources, videos: videosResponse.status === "fulfilled" ? videosResponse.value : [], community: communityResponse.status === "fulfilled" ? communityResponse.value : [] });
  const fileName = exportFileName(loaded.brief.title);
  const storedBytes = Buffer.from(markdown, "utf8");
  const stored = await storagePut(`users/${userId}/research-exports/${briefId}/${Date.now()}-${fileName}`, storedBytes, "text/markdown; charset=utf-8");
  const db = database(await getDb());
  const result = await db.insert(researchExports).values({ userId, researchBriefId: briefId, fileName, storageKey: stored.key, mimeType: "text/markdown", byteSize: storedBytes.byteLength });
  const rows = await db.select().from(researchExports).where(and5(eq5(researchExports.id, Number(result[0].insertId)), eq5(researchExports.userId, userId))).limit(1);
  return { export: rows[0], downloadUrl: await storageGetSignedUrl(stored.key) };
}
async function listResearchExports(userId, briefId) {
  await getResearchBrief(userId, briefId);
  const db = database(await getDb());
  return db.select().from(researchExports).where(and5(eq5(researchExports.researchBriefId, briefId), eq5(researchExports.userId, userId))).orderBy(desc4(researchExports.createdAt));
}
async function getResearchExportDownload(userId, exportId) {
  const db = database(await getDb());
  const result = await db.select().from(researchExports).where(and5(eq5(researchExports.id, exportId), eq5(researchExports.userId, userId))).limit(1);
  if (!result[0]) throw new Error("Research export not found.");
  return { export: result[0], downloadUrl: await storageGetSignedUrl(result[0].storageKey) };
}
async function getResearchExportFile(userId, exportId) {
  const record = await getResearchExportDownload(userId, exportId);
  const response = await fetch(record.downloadUrl);
  if (!response.ok) throw new Error("The saved research document could not be retrieved.");
  return { fileName: record.export.fileName, mimeType: record.export.mimeType || "text/markdown", bytes: Buffer.from(await response.arrayBuffer()) };
}

// server/notesService.ts
import { and as and6, desc as desc5, eq as eq6, like } from "drizzle-orm";
function database2(value) {
  if (!value) throw new Error("The database connection is not available.");
  return value;
}
function text3(value) {
  return typeof value === "string" ? value : "";
}
async function ownedSource(userId, input) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  if (!input.documentId) return `Student topic: ${input.topic || input.scopeLabel}
Requested scope: ${input.scopeLabel}`;
  const db = database2(await getDb());
  const document = await db.select().from(documents).where(and6(eq6(documents.id, input.documentId), eq6(documents.userId, userId), eq6(documents.status, "ready"))).limit(1);
  if (!document[0]) throw new Error("Document not found.");
  const matching = await db.select().from(documentChunks).where(and6(eq6(documentChunks.documentId, input.documentId), eq6(documentChunks.userId, userId), like(documentChunks.content, `%${input.scopeLabel}%`))).limit(14);
  const chunks = matching.length ? matching : await db.select().from(documentChunks).where(and6(eq6(documentChunks.documentId, input.documentId), eq6(documentChunks.userId, userId))).limit(18);
  return `Book: ${document[0].originalName}
Requested ${input.scopeType}: ${input.scopeLabel}

${chunks.map((chunk) => chunk.content).join("\n\n").slice(0, 24e3)}`;
}
async function listStudyNotes(userId) {
  const db = database2(await getDb());
  return db.select().from(studyNotes).where(eq6(studyNotes.userId, userId)).orderBy(desc5(studyNotes.updatedAt));
}
async function getStudyNote(userId, noteId) {
  const db = database2(await getDb());
  const note = await db.select().from(studyNotes).where(and6(eq6(studyNotes.id, noteId), eq6(studyNotes.userId, userId))).limit(1);
  if (!note[0]) throw new Error("Study note not found.");
  const stickies = await db.select().from(stickyNotes).where(and6(eq6(stickyNotes.studyNoteId, noteId), eq6(stickyNotes.userId, userId))).orderBy(desc5(stickyNotes.updatedAt));
  return { note: note[0], stickyNotes: stickies };
}
async function generateStudyNotes(userId, input) {
  const source = await ownedSource(userId, input);
  const response = await invokeLLM({ messages: [{ role: "system", content: "Create clear and strictly source-grounded academic notes. Use a hierarchy of headings and bullets, explain difficult ideas in simple terms, and do not invent content absent from the supplied material." }, { role: "user", content: `Create polished study notes titled '${input.title}' for the requested ${input.scopeType}: '${input.scopeLabel}'. Include a concise overview, four to seven headed sections with key bullets, and three revision reminders.

${source}` }], response_format: { type: "json_schema", json_schema: { name: "study_notes", strict: true, schema: { type: "object", properties: { overview: { type: "string" }, sections: { type: "array", minItems: 4, maxItems: 7, items: { type: "object", properties: { heading: { type: "string" }, explanation: { type: "string" }, bullets: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } } }, required: ["heading", "explanation", "bullets"], additionalProperties: false } }, revisionReminders: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } } }, required: ["overview", "sections", "revisionReminders"], additionalProperties: false } } }, maxTokens: 2800 });
  const content2 = safeParseJSON(text3(response.choices[0]?.message.content));
  if (!content2.overview || !Array.isArray(content2.sections) || !Array.isArray(content2.revisionReminders)) throw new Error("The notes generator returned an invalid result.");
  const db = database2(await getDb());
  const inserted = await db.insert(studyNotes).values({ userId, subjectId: input.subjectId ?? null, documentId: input.documentId ?? null, title: input.title, scopeType: input.scopeType, scopeLabel: input.scopeLabel, content: content2, model: response.model });
  return getStudyNote(userId, Number(inserted[0].insertId));
}
async function addStickyNote(userId, studyNoteId, input) {
  await getStudyNote(userId, studyNoteId);
  const db = database2(await getDb());
  const inserted = await db.insert(stickyNotes).values({ userId, studyNoteId, content: input.content, color: input.color });
  const stored = await db.select().from(stickyNotes).where(and6(eq6(stickyNotes.id, Number(inserted[0].insertId)), eq6(stickyNotes.userId, userId))).limit(1);
  return stored[0];
}
async function generateRevisionGuide(userId, input) {
  const source = await ownedSource(userId, input);
  const response = await invokeLLM({ messages: [{ role: "system", content: "Create a pragmatic academic revision guide only from the supplied study source. It should prioritize retrieval practice, misconceptions, and short focused sessions." }, { role: "user", content: `Create a revision guide titled '${input.title}' for '${input.scopeLabel}'. Return a short overview, four to six revision blocks, and an end-of-session self-check list.

${source}` }], response_format: { type: "json_schema", json_schema: { name: "revision_guide", strict: true, schema: { type: "object", properties: { overview: { type: "string" }, blocks: { type: "array", minItems: 4, maxItems: 6, items: { type: "object", properties: { title: { type: "string" }, focus: { type: "string" }, questions: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } } }, required: ["title", "focus", "questions"], additionalProperties: false } }, selfCheck: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } } }, required: ["overview", "blocks", "selfCheck"], additionalProperties: false } } }, maxTokens: 2400 });
  const content2 = safeParseJSON(text3(response.choices[0]?.message.content));
  const db = database2(await getDb());
  const inserted = await db.insert(revisionGuides).values({ userId, subjectId: input.subjectId ?? null, documentId: input.documentId ?? null, title: input.title, scopeLabel: input.scopeLabel, content: content2, model: response.model });
  const stored = await db.select().from(revisionGuides).where(and6(eq6(revisionGuides.id, Number(inserted[0].insertId)), eq6(revisionGuides.userId, userId))).limit(1);
  return stored[0];
}
async function listRevisionGuides(userId) {
  const db = database2(await getDb());
  return db.select().from(revisionGuides).where(eq6(revisionGuides.userId, userId)).orderBy(desc5(revisionGuides.createdAt));
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content2 = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content2.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content: content2 };
};
async function notifyOwner(payload) {
  const { title, content: content2 } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content: content2 })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/validators.ts
import { z as z2 } from "zod";
var subjectInput = z2.object({
  name: z2.string().trim().min(1, "A subject name is required").max(120),
  description: z2.string().trim().max(2e3).optional(),
  color: z2.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid color").default("#4f46e5")
});
var courseInput = z2.object({
  subjectId: z2.number().int().positive(),
  name: z2.string().trim().min(1).max(160),
  code: z2.string().trim().max(48).optional(),
  description: z2.string().trim().max(2e3).optional()
});
var topicInput = z2.object({
  subjectId: z2.number().int().positive(),
  courseId: z2.number().int().positive().nullable().optional(),
  name: z2.string().trim().min(1).max(160),
  notes: z2.string().trim().max(2e4).optional()
});
var profileInput = z2.object({
  preferredName: z2.string().trim().min(1).max(120).nullable().optional(),
  studyLevel: z2.string().trim().max(80).nullable().optional(),
  timezone: z2.string().trim().min(1).max(80)
});
var studyPlanInput = z2.object({
  subjectId: z2.number().int().positive().nullable().optional(),
  title: z2.string().trim().min(1).max(200),
  examDate: z2.date().nullable().optional()
});
var studyPlanItemInput = z2.object({
  planId: z2.number().int().positive(),
  title: z2.string().trim().min(1).max(255),
  notes: z2.string().trim().max(4e3).nullable().optional(),
  scheduledFor: z2.date().nullable().optional(),
  estimatedMinutes: z2.number().int().min(5).max(720).default(30)
});
var studySessionInput = z2.object({
  subjectId: z2.number().int().positive().nullable().optional(),
  planItemId: z2.number().int().positive().nullable().optional(),
  startedAt: z2.date(),
  endedAt: z2.date().nullable().optional(),
  minutesStudied: z2.number().int().min(1).max(1440)
});
var learningModeInput = z2.enum(["explain", "teach", "simplify", "examples", "step_by_step", "quiz_me", "practice", "exam_prep"]);
var chatConversationInput = z2.object({
  title: z2.string().trim().min(1).max(180).optional(),
  learningMode: learningModeInput.default("teach"),
  subjectId: z2.number().int().positive().nullable().optional()
});
var chatMessageInput = z2.object({ conversationId: z2.number().int().positive(), content: z2.string().trim().min(1).max(12e3), documentId: z2.number().int().positive().optional() });
var quizGenerationInput = z2.object({ title: z2.string().trim().min(1).max(200), topic: z2.string().trim().min(1).max(1e3), subjectId: z2.number().int().positive().nullable().optional(), documentId: z2.number().int().positive().nullable().optional(), scopeType: z2.enum(["topic", "chapter", "section", "range", "document"]).default("topic"), scopeLabel: z2.string().trim().min(1).max(300).optional(), questionCount: z2.number().int().min(3).max(15).default(5), difficulty: z2.enum(["easy", "medium", "hard"]) });
var flashcardGenerationInput = z2.object({ topic: z2.string().trim().min(1).max(1e3), subjectId: z2.number().int().positive().nullable().optional(), documentId: z2.number().int().positive().nullable().optional(), scopeType: z2.enum(["topic", "chapter", "section", "range", "document"]).default("topic"), scopeLabel: z2.string().trim().min(1).max(300).optional() });

// server/routers.ts
function toApiError(error) {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  if (message.endsWith("not found.")) throw new TRPCError3({ code: "NOT_FOUND", message });
  throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "We could not complete that action. Please try again." });
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  workspace: router({
    bootstrap: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await ensureProfile(ctx.user.id, ctx.user.name);
      } catch (error) {
        return toApiError(error);
      }
    }),
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await getDashboardData(ctx.user.id);
      } catch (error) {
        return toApiError(error);
      }
    }),
    updateProfile: protectedProcedure.input(profileInput).mutation(async ({ ctx, input }) => {
      try {
        return await updateProfile(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    })
  }),
  academic: router({
    listSubjects: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listSubjects(ctx.user.id);
      } catch (error) {
        return toApiError(error);
      }
    }),
    createSubject: protectedProcedure.input(subjectInput).mutation(async ({ ctx, input }) => {
      try {
        return await createSubject(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    updateSubject: protectedProcedure.input(z3.object({ id: z3.number().int().positive(), data: subjectInput.partial() })).mutation(async ({ ctx, input }) => {
      try {
        return await updateSubject(ctx.user.id, input.id, input.data);
      } catch (error) {
        return toApiError(error);
      }
    }),
    deleteSubject: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        await deleteSubject(ctx.user.id, input.id);
        return { success: true };
      } catch (error) {
        return toApiError(error);
      }
    }),
    listCourses: protectedProcedure.input(z3.object({ subjectId: z3.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      try {
        return await listCourses(ctx.user.id, input?.subjectId);
      } catch (error) {
        return toApiError(error);
      }
    }),
    createCourse: protectedProcedure.input(courseInput).mutation(async ({ ctx, input }) => {
      try {
        return await createCourse(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    updateCourse: protectedProcedure.input(z3.object({ id: z3.number().int().positive(), data: courseInput.omit({ subjectId: true }).partial() })).mutation(async ({ ctx, input }) => {
      try {
        return await updateCourse(ctx.user.id, input.id, input.data);
      } catch (error) {
        return toApiError(error);
      }
    }),
    deleteCourse: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        await deleteCourse(ctx.user.id, input.id);
        return { success: true };
      } catch (error) {
        return toApiError(error);
      }
    }),
    listTopics: protectedProcedure.input(z3.object({ subjectId: z3.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      try {
        return await listTopics(ctx.user.id, input?.subjectId);
      } catch (error) {
        return toApiError(error);
      }
    }),
    createTopic: protectedProcedure.input(topicInput).mutation(async ({ ctx, input }) => {
      try {
        return await createTopic(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    updateTopic: protectedProcedure.input(z3.object({ id: z3.number().int().positive(), data: topicInput.pick({ name: true, notes: true }).partial() })).mutation(async ({ ctx, input }) => {
      try {
        return await updateTopic(ctx.user.id, input.id, input.data);
      } catch (error) {
        return toApiError(error);
      }
    }),
    deleteTopic: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        await deleteTopic(ctx.user.id, input.id);
        return { success: true };
      } catch (error) {
        return toApiError(error);
      }
    })
  }),
  planner: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listStudyPlans(ctx.user.id);
      } catch (error) {
        return toApiError(error);
      }
    }),
    createPlan: protectedProcedure.input(studyPlanInput).mutation(async ({ ctx, input }) => {
      try {
        return await createStudyPlan(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    updatePlan: protectedProcedure.input(z3.object({ id: z3.number().int().positive(), data: studyPlanInput.omit({ subjectId: true }).partial() })).mutation(async ({ ctx, input }) => {
      try {
        return await updateStudyPlan(ctx.user.id, input.id, input.data);
      } catch (error) {
        return toApiError(error);
      }
    }),
    deletePlan: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        await deleteStudyPlan(ctx.user.id, input.id);
        return { success: true };
      } catch (error) {
        return toApiError(error);
      }
    }),
    createItem: protectedProcedure.input(studyPlanItemInput).mutation(async ({ ctx, input }) => {
      try {
        return await createStudyPlanItem(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    updateItem: protectedProcedure.input(z3.object({ id: z3.number().int().positive(), data: studyPlanItemInput.omit({ planId: true }).partial() })).mutation(async ({ ctx, input }) => {
      try {
        return await updateStudyPlanItem(ctx.user.id, input.id, input.data);
      } catch (error) {
        return toApiError(error);
      }
    }),
    setItemCompletion: protectedProcedure.input(z3.object({ id: z3.number().int().positive(), completed: z3.boolean() })).mutation(async ({ ctx, input }) => {
      try {
        return await toggleStudyPlanItem(ctx.user.id, input.id, input.completed);
      } catch (error) {
        return toApiError(error);
      }
    }),
    logSession: protectedProcedure.input(studySessionInput).mutation(async ({ ctx, input }) => {
      try {
        return await createStudySession(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    updateSession: protectedProcedure.input(z3.object({ id: z3.number().int().positive(), data: studySessionInput.partial() })).mutation(async ({ ctx, input }) => {
      try {
        return await updateStudySession(ctx.user.id, input.id, input.data);
      } catch (error) {
        return toApiError(error);
      }
    })
  }),
  chat: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listChatConversations(ctx.user.id);
      } catch (error) {
        return toApiError(error);
      }
    }),
    models: protectedProcedure.query(async () => {
      try {
        return await availableChatModels();
      } catch (error) {
        return toApiError(error);
      }
    }),
    create: protectedProcedure.input(chatConversationInput).mutation(async ({ ctx, input }) => {
      try {
        return await createChatConversation(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    get: protectedProcedure.input(z3.object({ conversationId: z3.number().int().positive() })).query(async ({ ctx, input }) => {
      try {
        return await getChatConversation(ctx.user.id, input.conversationId);
      } catch (error) {
        return toApiError(error);
      }
    }),
    send: protectedProcedure.input(chatMessageInput).mutation(async ({ ctx, input }) => {
      try {
        return await sendChatMessage(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    regenerate: protectedProcedure.input(z3.object({ conversationId: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        return await regenerateChatMessage(ctx.user.id, input.conversationId);
      } catch (error) {
        return toApiError(error);
      }
    })
  }),
  documents: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listPrivateDocuments(ctx.user.id);
      } catch (error) {
        return toApiError(error);
      }
    })
  }),
  research: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listResearchBriefs(ctx.user.id);
      } catch (error) {
        return toApiError(error);
      }
    }),
    get: protectedProcedure.input(z3.object({ briefId: z3.number().int().positive() })).query(async ({ ctx, input }) => {
      try {
        return await getResearchBrief(ctx.user.id, input.briefId);
      } catch (error) {
        return toApiError(error);
      }
    }),
    create: protectedProcedure.input(z3.object({ title: z3.string().trim().min(3).max(220), researchQuestion: z3.string().trim().min(10).max(6e3), subjectId: z3.number().int().positive().nullable().optional(), topicId: z3.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
      try {
        return await createResearchBrief(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    createFromTopic: protectedProcedure.input(z3.object({ topic: z3.string().trim().min(3).max(220), subjectId: z3.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
      try {
        return await createResearchBriefFromTopic(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    synthesize: protectedProcedure.input(z3.object({ briefId: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        return await synthesizeResearchBrief(ctx.user.id, input.briefId);
      } catch (error) {
        return toApiError(error);
      }
    }),
    addSource: protectedProcedure.input(z3.object({ briefId: z3.number().int().positive(), title: z3.string().trim().min(3).max(300), url: z3.string().url().max(2048).nullable().optional(), note: z3.string().trim().max(12e3).nullable().optional() })).mutation(async ({ ctx, input }) => {
      try {
        return await addResearchSource(ctx.user.id, input.briefId, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    videos: protectedProcedure.input(z3.object({ query: z3.string().trim().min(3).max(240) })).query(async ({ input }) => {
      try {
        return await searchResearchVideos(input.query);
      } catch (error) {
        return toApiError(error);
      }
    }),
    community: protectedProcedure.input(z3.object({ query: z3.string().trim().min(3).max(240) })).query(async ({ input }) => {
      try {
        return await searchCommunityPerspectives(input.query);
      } catch (error) {
        return toApiError(error);
      }
    }),
    exports: protectedProcedure.input(z3.object({ briefId: z3.number().int().positive() })).query(async ({ ctx, input }) => {
      try {
        return await listResearchExports(ctx.user.id, input.briefId);
      } catch (error) {
        return toApiError(error);
      }
    }),
    exportDocument: protectedProcedure.input(z3.object({ briefId: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        return await exportResearchBrief(ctx.user.id, input.briefId);
      } catch (error) {
        return toApiError(error);
      }
    }),
    downloadExport: protectedProcedure.input(z3.object({ exportId: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        return await getResearchExportDownload(ctx.user.id, input.exportId);
      } catch (error) {
        return toApiError(error);
      }
    })
  }),
  notes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listStudyNotes(ctx.user.id);
      } catch (error) {
        return toApiError(error);
      }
    }),
    get: protectedProcedure.input(z3.object({ noteId: z3.number().int().positive() })).query(async ({ ctx, input }) => {
      try {
        return await getStudyNote(ctx.user.id, input.noteId);
      } catch (error) {
        return toApiError(error);
      }
    }),
    generate: protectedProcedure.input(z3.object({ title: z3.string().trim().min(3).max(260), topic: z3.string().trim().max(6e3).nullable().optional(), subjectId: z3.number().int().positive().nullable().optional(), documentId: z3.number().int().positive().nullable().optional(), scopeType: z3.enum(["topic", "chapter", "section", "range", "document"]), scopeLabel: z3.string().trim().min(2).max(300) })).mutation(async ({ ctx, input }) => {
      try {
        return await generateStudyNotes(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    addSticky: protectedProcedure.input(z3.object({ studyNoteId: z3.number().int().positive(), content: z3.string().trim().min(1).max(3e3), color: z3.enum(["yellow", "mint", "lavender", "peach"]) })).mutation(async ({ ctx, input }) => {
      try {
        return await addStickyNote(ctx.user.id, input.studyNoteId, input);
      } catch (error) {
        return toApiError(error);
      }
    })
  }),
  revision: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listRevisionGuides(ctx.user.id);
      } catch (error) {
        return toApiError(error);
      }
    }),
    generate: protectedProcedure.input(z3.object({ title: z3.string().trim().min(3).max(260), topic: z3.string().trim().max(6e3).nullable().optional(), subjectId: z3.number().int().positive().nullable().optional(), documentId: z3.number().int().positive().nullable().optional(), scopeType: z3.enum(["topic", "chapter", "section", "range", "document"]), scopeLabel: z3.string().trim().min(2).max(300) })).mutation(async ({ ctx, input }) => {
      try {
        return await generateRevisionGuide(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    })
  }),
  quizzes: router({
    generate: protectedProcedure.input(quizGenerationInput).mutation(async ({ ctx, input }) => {
      try {
        return await generateQuiz(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    get: protectedProcedure.input(z3.object({ quizId: z3.number().int().positive() })).query(async ({ ctx, input }) => {
      try {
        return await getQuiz(ctx.user.id, input.quizId);
      } catch (error) {
        return toApiError(error);
      }
    }),
    submit: protectedProcedure.input(z3.object({ quizId: z3.number().int().positive(), answers: z3.array(z3.object({ questionId: z3.number().int().positive(), answer: z3.string().max(500) })) })).mutation(async ({ ctx, input }) => {
      try {
        return await submitQuiz(ctx.user.id, input.quizId, input.answers);
      } catch (error) {
        return toApiError(error);
      }
    }),
    attempts: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listQuizAttemptHistory(ctx.user.id);
      } catch (error) {
        return toApiError(error);
      }
    })
  }),
  flashcards: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listFlashcards(ctx.user.id);
      } catch (error) {
        return toApiError(error);
      }
    }),
    generate: protectedProcedure.input(flashcardGenerationInput).mutation(async ({ ctx, input }) => {
      try {
        return await generateFlashcards(ctx.user.id, input);
      } catch (error) {
        return toApiError(error);
      }
    }),
    review: protectedProcedure.input(z3.object({ flashcardId: z3.number().int().positive(), outcome: z3.enum(["again", "hard", "good", "easy"]) })).mutation(async ({ ctx, input }) => {
      try {
        return await reviewFlashcard(ctx.user.id, input.flashcardId, input.outcome);
      } catch (error) {
        return toApiError(error);
      }
    }),
    reviews: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listFlashcardReviewHistory(ctx.user.id);
      } catch (error) {
        return toApiError(error);
      }
    })
  })
});

// server/_core/context.ts
import { createClient } from "@supabase/supabase-js";
var supabaseAdmin = null;
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return supabaseAdmin;
}
async function authenticateSupabaseRequest(req) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const externalId = `supabase:${data.user.id}`;
  const displayName = typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : typeof data.user.user_metadata?.name === "string" ? data.user.user_metadata.name : null;
  await upsertUser({
    openId: externalId,
    email: data.user.email ?? null,
    name: displayName,
    loginMethod: "supabase"
  });
  return await getUserByOpenId(externalId) ?? null;
}
async function createContext(opts) {
  let user = null;
  try {
    user = await authenticateSupabaseRequest(opts.req);
  } catch {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/app.ts
function createExpressApp() {
  const app2 = express2();
  app2.use(express2.json({ limit: "50mb" }));
  app2.use(express2.urlencoded({ limit: "50mb", extended: true }));
  app2.post("/api/documents/upload", express2.raw({ type: "application/pdf", limit: "12mb" }), async (req, res) => {
    try {
      const user = await authenticateSupabaseRequest(req);
      if (!user) return res.status(401).json({ error: "Authentication is required." });
      if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: "PDF content is required." });
      const originalName = typeof req.headers["x-file-name"] === "string" ? decodeURIComponent(req.headers["x-file-name"]) : "study-document.pdf";
      const subjectId = typeof req.headers["x-subject-id"] === "string" && req.headers["x-subject-id"] ? Number(req.headers["x-subject-id"]) : null;
      const document = await uploadPrivatePdf(user.id, { buffer: req.body, name: originalName, mimeType: "application/pdf", subjectId: Number.isInteger(subjectId) && subjectId > 0 ? subjectId : null });
      return res.status(201).json({ document });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Upload failed." });
    }
  });
  app2.get("/api/documents/:documentId/download", async (req, res) => {
    try {
      const user = await authenticateSupabaseRequest(req);
      if (!user) return res.status(401).json({ error: "Authentication is required." });
      const id = Number(req.params.documentId);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid document." });
      const signedUrl = await getPrivateDocumentDownload(user.id, id);
      return res.redirect(302, signedUrl);
    } catch {
      return res.status(404).json({ error: "Document not found." });
    }
  });
  app2.get("/api/research-exports/:exportId/download", async (req, res) => {
    try {
      const user = await authenticateSupabaseRequest(req);
      if (!user) return res.status(401).json({ error: "Authentication is required." });
      const id = Number(req.params.exportId);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid research export." });
      const file = await getResearchExportFile(user.id, id);
      const safeFileName = file.fileName.replace(/[\r\n"]/g, "_");
      res.status(200).set({ "Content-Type": file.mimeType, "Content-Length": String(file.bytes.byteLength), "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`, "Cache-Control": "private, no-store" });
      return res.send(file.bytes);
    } catch {
      return res.status(404).json({ error: "Research export not found." });
    }
  });
  app2.post("/api/chat/stream", async (req, res) => {
    try {
      const user = await authenticateSupabaseRequest(req);
      if (!user) return res.status(401).json({ error: "Authentication is required." });
      const content2 = typeof req.body?.content === "string" ? req.body.content.trim() : "";
      if (!content2 || content2.length > 12e3) return res.status(400).json({ error: "A valid study question is required." });
      const upstream = await streamLLM({ messages: [{ role: "system", content: "You are StudentGPT, a careful academic assistant. Use concise Markdown and acknowledge uncertainty rather than inventing claims." }, { role: "user", content: content2 }] });
      if (!upstream.body) throw new Error("The AI provider did not return a response stream.");
      res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let cancelled = false;
      res.on("close", () => {
        cancelled = true;
        reader.cancel().catch(() => void 0);
      });
      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
    } catch (error) {
      if (!res.headersSent) res.status(500).json({ error: error instanceof Error ? error.message : "Stream unavailable." });
      else res.end();
    }
  });
  app2.get("/api/auth/supabase-config", (_req, res) => {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return res.status(503).json({ error: "Authentication is not configured." });
    }
    return res.json({ url, anonKey });
  });
  registerStorageProxy(app2);
  registerOAuthRoutes(app2);
  app2.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app2;
}

// server/_core/index.ts
var app = createExpressApp();
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const server = createServer(app);
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
if (process.env.VERCEL !== "1") {
  startServer().catch(console.error);
}
var index_default = app;
export {
  app,
  index_default as default
};
