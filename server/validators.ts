import { z } from "zod";

export const subjectInput = z.object({
  name: z.string().trim().min(1, "A subject name is required").max(120),
  description: z.string().trim().max(2000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid color").default("#4f46e5"),
});

export const courseInput = z.object({
  subjectId: z.number().int().positive(),
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().max(48).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const topicInput = z.object({
  subjectId: z.number().int().positive(),
  courseId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(20000).optional(),
});

export const profileInput = z.object({
  preferredName: z.string().trim().min(1).max(120).nullable().optional(),
  studyLevel: z.string().trim().max(80).nullable().optional(),
  timezone: z.string().trim().min(1).max(80),
});

export const studyPlanInput = z.object({
  subjectId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  examDate: z.date().nullable().optional(),
});

export const studyPlanItemInput = z.object({
  planId: z.number().int().positive(),
  title: z.string().trim().min(1).max(255),
  notes: z.string().trim().max(4000).nullable().optional(),
  scheduledFor: z.date().nullable().optional(),
  estimatedMinutes: z.number().int().min(5).max(720).default(30),
});

export const studySessionInput = z.object({
  subjectId: z.number().int().positive().nullable().optional(),
  planItemId: z.number().int().positive().nullable().optional(),
  startedAt: z.date(),
  endedAt: z.date().nullable().optional(),
  minutesStudied: z.number().int().min(1).max(1440),
});

export const learningModeInput = z.enum(["explain", "teach", "simplify", "examples", "step_by_step", "quiz_me", "practice", "exam_prep"]);
export const chatConversationInput = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  learningMode: learningModeInput.default("teach"),
  subjectId: z.number().int().positive().nullable().optional(),
});
export const chatMessageInput = z.object({ conversationId: z.number().int().positive(), content: z.string().trim().min(1).max(12000), documentId: z.number().int().positive().optional() });
export const quizGenerationInput = z.object({ title: z.string().trim().min(1).max(200), topic: z.string().trim().min(1).max(1000), subjectId: z.number().int().positive().nullable().optional(), documentId: z.number().int().positive().nullable().optional(), scopeType: z.enum(["topic", "chapter", "section", "range", "document"]).default("topic"), scopeLabel: z.string().trim().min(1).max(300).optional(), questionCount: z.number().int().min(3).max(15).default(5), difficulty: z.enum(["easy", "medium", "hard"]) });
export const flashcardGenerationInput = z.object({ topic: z.string().trim().min(1).max(1000), subjectId: z.number().int().positive().nullable().optional(), documentId: z.number().int().positive().nullable().optional(), scopeType: z.enum(["topic", "chapter", "section", "range", "document"]).default("topic"), scopeLabel: z.string().trim().min(1).max(300).optional() });
