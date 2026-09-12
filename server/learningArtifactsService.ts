import { and, asc, eq } from "drizzle-orm";
import { attemptAnswers, documentChunks, documents, flashcardReviews, flashcards, quizAttempts, quizQuestions, quizzes } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { assertOwnedSubject, getDb } from "./db";

function dbOrThrow<T>(db: T | null): T { if (!db) throw new Error("The database connection is not available."); return db; }
function text(value: unknown) { return typeof value === "string" ? value : ""; }

async function studySource(userId: number, topic: string, documentId?: number, scopeLabel?: string) {
  const db = dbOrThrow(await getDb());
  if (!documentId) return `Topic: ${topic}`;
  const document = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId), eq(documents.status, "ready"))).limit(1);
  if (!document[0]) throw new Error("Document not found.");
  const chunks = await db.select().from(documentChunks).where(and(eq(documentChunks.documentId, documentId), eq(documentChunks.userId, userId))).limit(18);
  return `Document: ${document[0].originalName}\nRequested scope: ${scopeLabel || topic}\n\n${chunks.map(chunk => chunk.content).join("\n\n").slice(0, 24000)}`;
}

export async function generateQuiz(userId: number, input: { title: string; topic: string; subjectId?: number | null; documentId?: number | null; scopeType?: "topic" | "chapter" | "section" | "range" | "document"; scopeLabel?: string; questionCount?: number; difficulty: "easy" | "medium" | "hard" }) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  const count = input.questionCount ?? 5; const scope = input.scopeLabel || input.topic; const source = await studySource(userId, input.topic, input.documentId ?? undefined, scope);
  const response = await invokeLLM({
    messages: [{ role: "system", content: "Create academically accurate quiz questions from the supplied study source. Return only valid structured data. Do not invent source claims." }, { role: "user", content: `Difficulty: ${input.difficulty}\nRequested ${input.scopeType ?? "topic"}: ${scope}\nCreate exactly ${count} multiple-choice questions, each with four options, one exact correctAnswer, and a concise explanation.\n\n${source}` }],
    response_format: { type: "json_schema", json_schema: { name: "quiz", strict: true, schema: { type: "object", properties: { questions: { type: "array", minItems: count, maxItems: count, items: { type: "object", properties: { prompt: { type: "string" }, options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } }, correctAnswer: { type: "string" }, explanation: { type: "string" } }, required: ["prompt", "options", "correctAnswer", "explanation"], additionalProperties: false } } }, required: ["questions"], additionalProperties: false } } },
    maxTokens: 1800,
  });
  const raw = text(response.choices[0]?.message.content); const generated = JSON.parse(raw) as { questions: Array<{ prompt: string; options: string[]; correctAnswer: string; explanation: string }> };
  if (!Array.isArray(generated.questions) || generated.questions.length !== count) throw new Error("The quiz generator returned an invalid result. Please try again.");
  const db = dbOrThrow(await getDb());
  const inserted = await db.insert(quizzes).values({ userId, subjectId: input.subjectId ?? null, documentId: input.documentId ?? null, title: input.title, difficulty: input.difficulty, sourceType: input.documentId ? "document" : "topic" });
  const quizId = Number(inserted[0].insertId);
  for (let position = 0; position < generated.questions.length; position++) { const question = generated.questions[position]; await db.insert(quizQuestions).values({ quizId, position, questionType: "multiple_choice", prompt: question.prompt, options: question.options, correctAnswer: question.correctAnswer, explanation: question.explanation }); }
  return getQuiz(userId, quizId);
}

export async function getQuiz(userId: number, quizId: number) {
  const db = dbOrThrow(await getDb());
  const quiz = await db.select().from(quizzes).where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId))).limit(1); if (!quiz[0]) throw new Error("Quiz not found.");
  const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId)).orderBy(asc(quizQuestions.position)); return { quiz: quiz[0], questions };
}

export async function submitQuiz(userId: number, quizId: number, answers: Array<{ questionId: number; answer: string }>) {
  const loaded = await getQuiz(userId, quizId); const db = dbOrThrow(await getDb()); const map = new Map(answers.map(answer => [answer.questionId, answer.answer.trim().toLowerCase()]));
  const score = loaded.questions.reduce((total, question) => total + (map.get(question.id) === question.correctAnswer.trim().toLowerCase() ? 1 : 0), 0);
  const inserted = await db.insert(quizAttempts).values({ quizId, userId, score, totalQuestions: loaded.questions.length }); const attemptId = Number(inserted[0].insertId);
  for (const question of loaded.questions) { const answer = map.get(question.id) ?? ""; await db.insert(attemptAnswers).values({ attemptId, questionId: question.id, answer, isCorrect: answer === question.correctAnswer.trim().toLowerCase() }); }
  return { score, totalQuestions: loaded.questions.length, questions: loaded.questions };
}

export async function generateFlashcards(userId: number, input: { topic: string; subjectId?: number | null; documentId?: number | null; scopeType?: "topic" | "chapter" | "section" | "range" | "document"; scopeLabel?: string }) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  const source = await studySource(userId, input.topic, input.documentId ?? undefined, input.scopeLabel || input.topic);
  const response = await invokeLLM({ messages: [{ role: "system", content: "Create concise, high-value academic flashcards from the supplied source. Return only valid structured data." }, { role: "user", content: `Create exactly 8 flashcards with a direct question on the front and a concise correct answer on the back.\n\n${source}` }], response_format: { type: "json_schema", json_schema: { name: "flashcards", strict: true, schema: { type: "object", properties: { cards: { type: "array", minItems: 8, maxItems: 8, items: { type: "object", properties: { front: { type: "string" }, back: { type: "string" } }, required: ["front", "back"], additionalProperties: false } } }, required: ["cards"], additionalProperties: false } } }, maxTokens: 1500 });
  const raw = text(response.choices[0]?.message.content); const generated = JSON.parse(raw) as { cards: Array<{ front: string; back: string }> }; if (!Array.isArray(generated.cards) || generated.cards.length !== 8) throw new Error("The flashcard generator returned an invalid result. Please try again.");
  const db = dbOrThrow(await getDb()); const created = [];
  for (const card of generated.cards) { const result = await db.insert(flashcards).values({ userId, subjectId: input.subjectId ?? null, documentId: input.documentId ?? null, front: card.front, back: card.back, sourceType: input.documentId ? "document" : "topic" }); const id = Number(result[0].insertId); const stored = await db.select().from(flashcards).where(and(eq(flashcards.id, id), eq(flashcards.userId, userId))).limit(1); created.push(stored[0]!); }
  return created;
}

export async function listFlashcards(userId: number) { const db = dbOrThrow(await getDb()); return db.select().from(flashcards).where(eq(flashcards.userId, userId)).orderBy(asc(flashcards.createdAt)); }
export async function reviewFlashcard(userId: number, flashcardId: number, outcome: "again" | "hard" | "good" | "easy") { const db = dbOrThrow(await getDb()); const card = await db.select({ id: flashcards.id }).from(flashcards).where(and(eq(flashcards.id, flashcardId), eq(flashcards.userId, userId))).limit(1); if (!card[0]) throw new Error("Flashcard not found."); await db.insert(flashcardReviews).values({ flashcardId, userId, outcome }); return { success: true } as const; }
export async function listQuizAttemptHistory(userId: number) { const db = dbOrThrow(await getDb()); return db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)).orderBy(asc(quizAttempts.completedAt)); }
export async function listFlashcardReviewHistory(userId: number) { const db = dbOrThrow(await getDb()); return db.select().from(flashcardReviews).where(eq(flashcardReviews.userId, userId)).orderBy(asc(flashcardReviews.reviewedAt)); }
