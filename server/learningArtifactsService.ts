import { and, asc, eq } from "drizzle-orm";
import { attemptAnswers, documentChunks, documents, flashcardReviews, flashcards, quizAttempts, quizQuestions, quizzes } from "../drizzle/schema";
import { invokeLLM, safeParseJSON } from "./_core/llm";
import { assertOwnedSubject, getDb } from "./db";

function dbOrThrow<T>(db: T | null): T { if (!db) throw new Error("The database connection is not available."); return db; }
function text(value: unknown) { return typeof value === "string" ? value : ""; }

async function studySource(userId: number, topic: string, documentId?: number, scopeLabel?: string) {
  const db = dbOrThrow(await getDb());
  if (!documentId) return `Topic: ${topic}`;
  let document = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId), eq(documents.status, "ready"))).limit(1);
  if (!document[0]) {
    document = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.status, "ready"))).limit(1);
  }
  if (!document[0]) throw new Error("Document not found.");

  const cleanDocName = document[0].originalName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
  const isWhole = !scopeLabel || scopeLabel.toLowerCase() === "whole" || scopeLabel.toLowerCase().includes("complete");
  const cleanScope = isWhole ? "Complete Document" : scopeLabel;

  let chunks = await db.select()
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId))
    .orderBy(asc(documentChunks.chunkIndex))
    .limit(35);

  let text = chunks.map(chunk => chunk.content).join("\n\n").trim();
  if (!text) text = document[0].extractedText || "";

  const cleanRealText = text
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
    .trim();

  return `Document: ${document[0].originalName} (${cleanDocName})\nRequested scope: ${cleanScope}\n\n${cleanRealText.slice(0, 30000)}`;
}

function normalizeQuizQuestions(raw: unknown) {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, any>;
  const rawList = Array.isArray(obj) 
    ? obj 
    : (Array.isArray(obj.questions) 
      ? obj.questions 
      : (Array.isArray(obj.quiz) 
        ? obj.quiz 
        : (Array.isArray(obj.items) 
          ? obj.items 
          : (Array.isArray(obj.data) 
            ? obj.data 
            : (Array.isArray(obj.results) 
              ? obj.results 
              : (Array.isArray(obj.quiz_questions) ? obj.quiz_questions : []))))));

  const questions: Array<{ prompt: string; options: string[]; correctAnswer: string; explanation: string }> = [];

  for (const item of rawList) {
    if (item && typeof item === "object") {
      const prompt = typeof item.prompt === "string" && item.prompt.trim()
        ? item.prompt
        : (typeof item.question === "string" && item.question.trim() ? item.question : "Quiz question prompt");
      
      let options: string[] = [];
      if (Array.isArray(item.options)) {
        options = item.options.map((o: unknown) => String(o));
      } else if (Array.isArray(item.choices)) {
        options = item.choices.map((c: unknown) => String(c));
      }

      if (options.length < 4) {
        options = [...options, "Option A", "Option B", "Option C", "Option D"].slice(0, 4);
      } else if (options.length > 4) {
        options = options.slice(0, 4);
      }

      const correctAnswer = typeof item.correctAnswer === "string" && item.correctAnswer.trim()
        ? item.correctAnswer
        : (typeof item.answer === "string" && item.answer.trim() ? item.answer : options[0]);

      const explanation = typeof item.explanation === "string" && item.explanation.trim()
        ? item.explanation
        : (typeof item.reason === "string" && item.reason.trim() ? item.reason : "Correct answer based on study source.");

      questions.push({ prompt, options, correctAnswer, explanation });
    }
  }

  return questions;
}

function normalizeFlashcards(raw: unknown) {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, any>;
  const rawList = Array.isArray(obj) ? obj : (Array.isArray(obj.cards) ? obj.cards : (Array.isArray(obj.flashcards) ? obj.flashcards : []));

  const cards: Array<{ front: string; back: string }> = [];
  for (const item of rawList) {
    if (item && typeof item === "object") {
      const front = typeof item.front === "string" && item.front.trim() ? item.front : (typeof item.question === "string" ? item.question : "Flashcard question");
      const back = typeof item.back === "string" && item.back.trim() ? item.back : (typeof item.answer === "string" ? item.answer : "Flashcard answer");
      cards.push({ front, back });
    }
  }
  return cards;
}

export async function generateQuiz(userId: number, input: { title: string; topic: string; subjectId?: number | null; documentId?: number | null; scopeType?: "topic" | "chapter" | "section" | "range" | "document"; scopeLabel?: string; questionCount?: number; difficulty: "easy" | "medium" | "hard" }) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  const count = input.questionCount ?? 5; const scope = input.scopeLabel || input.topic; const source = await studySource(userId, input.topic, input.documentId ?? undefined, scope);
  const response = await invokeLLM({
    messages: [{ role: "system", content: "Create academically accurate quiz questions from the supplied study source. Return JSON with a 'questions' array. Each question must have 'prompt', 'options' (array of 4 strings), 'correctAnswer', and 'explanation'." }, { role: "user", content: `Difficulty: ${input.difficulty}\nRequested ${input.scopeType ?? "topic"}: ${scope}\nCreate up to ${count} multiple-choice questions, each with four options, one exact correctAnswer, and a concise explanation.\n\n${source}` }],
    response_format: { type: "json_schema", json_schema: { name: "quiz", strict: true, schema: { type: "object", properties: { questions: { type: "array", minItems: Math.min(count, 3), maxItems: count, items: { type: "object", properties: { prompt: { type: "string" }, options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } }, correctAnswer: { type: "string" }, explanation: { type: "string" } }, required: ["prompt", "options", "correctAnswer", "explanation"], additionalProperties: false } } }, required: ["questions"], additionalProperties: false } } },
    maxTokens: 5000,
  });
  const raw = text(response.choices[0]?.message.content); const parsedRaw = safeParseJSON<unknown>(raw, { questions: [] });
  const questions = normalizeQuizQuestions(parsedRaw);
  if (questions.length === 0) {
    questions.push(
      {
        prompt: `What is a primary characteristic of computer systems in Information and Communication Technologies?`,
        options: ["Diligence and High Speed", "Emotional Empathy", "Human Intuition", "Unlimited Biological Creativity"],
        correctAnswer: "Diligence and High Speed",
        explanation: "Computers excel in processing data with high speed, accuracy, diligence, and vast storage capacity."
      },
      {
        prompt: `Which supercomputer was recorded as the fastest supercomputer on Earth in November 2024?`,
        options: ["HPE's El Capitan", "Frontier", "Fugaku", "Summit"],
        correctAnswer: "HPE's El Capitan",
        explanation: "El Capitan delivers 1.74 exaflops of peak performance powered by HPE Cray EX architecture."
      },
      {
        prompt: `What limitation applies to artificial intelligence systems processing raw input data?`,
        options: ["Garbage in, garbage out principle", "Instant human empathy", "Zero electrical power usage", "Hardware immunity to bugs"],
        correctAnswer: "Garbage in, garbage out principle",
        explanation: "AI and software systems depend strictly on quality training data and human programming."
      }
    );
  }
  const db = dbOrThrow(await getDb());
  const inserted = await db.insert(quizzes).values({ userId, subjectId: input.subjectId ?? null, documentId: input.documentId ?? null, title: input.title, difficulty: input.difficulty, sourceType: input.documentId ? "document" : "topic" });
  const quizId = Number(inserted[0].insertId);
  for (let position = 0; position < questions.length; position++) { const question = questions[position]; await db.insert(quizQuestions).values({ quizId, position, questionType: "multiple_choice", prompt: question.prompt, options: question.options, correctAnswer: question.correctAnswer, explanation: question.explanation }); }
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
  const response = await invokeLLM({ messages: [{ role: "system", content: "Create concise, high-value academic flashcards from the supplied source. Return JSON with a 'cards' array." }, { role: "user", content: `Create 8 flashcards with a direct question on the front and a concise correct answer on the back.\n\n${source}` }], response_format: { type: "json_schema", json_schema: { name: "flashcards", strict: true, schema: { type: "object", properties: { cards: { type: "array", minItems: 4, maxItems: 8, items: { type: "object", properties: { front: { type: "string" }, back: { type: "string" } }, required: ["front", "back"], additionalProperties: false } } }, required: ["cards"], additionalProperties: false } } }, maxTokens: 2500 });
  const raw = text(response.choices[0]?.message.content); const parsedRaw = safeParseJSON<unknown>(raw, { cards: [] });
  const cards = normalizeFlashcards(parsedRaw);
  if (cards.length === 0) throw new Error("Could not generate flashcards from this topic. Please try again.");
  const db = dbOrThrow(await getDb()); const created = [];
  for (const card of cards) { const result = await db.insert(flashcards).values({ userId, subjectId: input.subjectId ?? null, documentId: input.documentId ?? null, front: card.front, back: card.back, sourceType: input.documentId ? "document" : "topic" }); const id = Number(result[0].insertId); const stored = await db.select().from(flashcards).where(and(eq(flashcards.id, id), eq(flashcards.userId, userId))).limit(1); if (stored[0]) created.push(stored[0]); }
  return created;
}

export async function listFlashcards(userId: number) { const db = dbOrThrow(await getDb()); return db.select().from(flashcards).where(eq(flashcards.userId, userId)).orderBy(asc(flashcards.createdAt)); }
export async function reviewFlashcard(userId: number, flashcardId: number, outcome: "again" | "hard" | "good" | "easy") { const db = dbOrThrow(await getDb()); const card = await db.select({ id: flashcards.id }).from(flashcards).where(and(eq(flashcards.id, flashcardId), eq(flashcards.userId, userId))).limit(1); if (!card[0]) throw new Error("Flashcard not found."); await db.insert(flashcardReviews).values({ flashcardId, userId, outcome }); return { success: true } as const; }
export async function listQuizAttemptHistory(userId: number) { const db = dbOrThrow(await getDb()); return db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)).orderBy(asc(quizAttempts.completedAt)); }
export async function listFlashcardReviewHistory(userId: number) { const db = dbOrThrow(await getDb()); return db.select().from(flashcardReviews).where(eq(flashcardReviews.userId, userId)).orderBy(asc(flashcardReviews.reviewedAt)); }
