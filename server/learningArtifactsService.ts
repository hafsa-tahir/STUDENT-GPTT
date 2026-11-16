import { and, asc, eq } from "drizzle-orm";
import { attemptAnswers, documentChunks, documents, flashcardReviews, flashcards, quizAttempts, quizQuestions, quizzes } from "../drizzle/schema";
import { invokeLLM, safeParseJSON } from "./_core/llm";
import { assertOwnedSubject, getDb } from "./db";

function dbOrThrow<T>(db: T | null): T { if (!db) throw new Error("The database connection is not available."); return db; }
function text(value: unknown) { return typeof value === "string" ? value : ""; }

async function studySource(userId: number, topic: string, documentId?: number, scopeLabel?: string) {
  const db = dbOrThrow(await getDb());
  if (!documentId) return `Topic: ${topic}`;
  const document = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId), eq(documents.status, "ready"))).limit(1);
  if (!document[0]) throw new Error("The selected PDF document could not be found.");

  const cleanDocName = document[0].originalName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
  const isWhole = !scopeLabel || scopeLabel.toLowerCase() === "whole" || scopeLabel.toLowerCase().includes("complete");
  const cleanScope = isWhole ? "Complete Document" : scopeLabel;

  let text = (document[0].extractedText || "").trim();
  if (!text || text.length < 100) {
    let chunks = await db.select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .orderBy(asc(documentChunks.chunkIndex))
      .limit(45);
    text = chunks.map(chunk => chunk.content).join("\n\n").trim();
  }

  const cleanRealText = text
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
    .trim();

  let sampledText = cleanRealText;
  if (cleanRealText.length > 10000) {
    const mid = Math.floor(cleanRealText.length / 2);
    sampledText = [
      cleanRealText.slice(0, 3800),
      cleanRealText.slice(Math.max(0, mid - 1700), mid + 1700),
      cleanRealText.slice(-3000),
    ].join("\n\n---\n\n");
  }

  return `STRICT SOURCE BOUNDING: Generate questions ONLY from this exact document. Do NOT use any other topic or outside subject.\nDocument: ${document[0].originalName} (${cleanDocName})\nRequested scope: ${cleanScope}\n\n${sampledText}`;
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
  let effectiveSubjectId = input.subjectId ?? null;
  if (!effectiveSubjectId && input.documentId) {
    const db = dbOrThrow(await getDb());
    const doc = await db.select({ subjectId: documents.subjectId }).from(documents).where(and(eq(documents.id, input.documentId), eq(documents.userId, userId))).limit(1);
    if (doc[0]?.subjectId) {
      effectiveSubjectId = doc[0].subjectId;
    }
  }
  if (effectiveSubjectId) await assertOwnedSubject(userId, effectiveSubjectId);
  const count = Math.max(3, Math.min(15, Number(input.questionCount) || 5));
  const scope = input.scopeLabel || input.topic;
  const source = await studySource(userId, input.topic, input.documentId ?? undefined, scope);

  const questions: Array<{ prompt: string; options: string[]; correctAnswer: string; explanation: string }> = [];
  const maxBatches = Math.ceil(count / 5) + 1;

  for (let batchIdx = 0; batchIdx < maxBatches && questions.length < count; batchIdx++) {
    const needed = Math.min(5, count - questions.length);
    const existingPrompts = questions.map(q => q.prompt).join(" | ");
    const avoidClause = existingPrompts ? `\nDo NOT repeat these questions: ${existingPrompts}` : "";
    const sysPrompt = `You are a rigorous university exam author. Create EXACTLY ${needed} multiple-choice quiz questions strictly from the supplied study source. NEVER invent questions from another subject or outside document. Return ONLY a JSON object with a "questions" array containing EXACTLY ${needed} items. Each item must have "prompt", "options" (array of 4 strings), "correctAnswer" (must match one of the 4 options), and "explanation".`;
    const usrPrompt = `Difficulty: ${input.difficulty}\nRequested ${input.scopeType ?? "topic"}: ${scope}\nREQUIRED QUESTION COUNT: Generate EXACTLY ${needed} multiple-choice questions strictly from the study source below.${avoidClause}\n\n${source}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: usrPrompt }
        ],
        response_format: { type: "json_object" },
        maxTokens: 1150,
      });
      const raw = text(response.choices[0]?.message.content);
      const batchQuestions = normalizeQuizQuestions(safeParseJSON<unknown>(raw, { questions: [] }));
      for (const bq of batchQuestions) {
        if (questions.length < count && !questions.some(existing => existing.prompt === bq.prompt)) {
          questions.push(bq);
        }
      }
    } catch (e) {
      console.warn(`Quiz batch ${batchIdx + 1} failed:`, e);
    }
  }

  if (questions.length === 0) {
    throw new Error("Could not generate quiz questions from the selected document. Please try again.");
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
  let effectiveSubjectId = input.subjectId ?? null;
  if (!effectiveSubjectId && input.documentId) {
    const db = dbOrThrow(await getDb());
    const doc = await db.select({ subjectId: documents.subjectId }).from(documents).where(and(eq(documents.id, input.documentId), eq(documents.userId, userId))).limit(1);
    if (doc[0]?.subjectId) {
      effectiveSubjectId = doc[0].subjectId;
    }
  }
  if (effectiveSubjectId) await assertOwnedSubject(userId, effectiveSubjectId);
  const source = await studySource(userId, input.topic, input.documentId ?? undefined, input.scopeLabel || input.topic);
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an academic flashcard author. Create 8 high-yield flashcards STRICTLY from the supplied study source. NEVER include concepts from any other document or outside subject. Return ONLY a valid JSON object with a 'cards' array where each item has 'front' and 'back'." },
      { role: "user", content: `Create 8 flashcards with a clear question/concept on 'front' and a concise, accurate answer on 'back', strictly from this source:\n\n${source}` }
    ],
    response_format: { type: "json_object" },
    maxTokens: 2500
  });
  const raw = text(response.choices[0]?.message.content);
  const parsedRaw = safeParseJSON<unknown>(raw, { cards: [] });
  const cards = normalizeFlashcards(parsedRaw);
  if (cards.length === 0) throw new Error("Could not generate flashcards from this document. Please try again.");
  const db = dbOrThrow(await getDb());
  // Replace previous flashcard deck so cards from older PDFs never mix with the current PDF
  await db.delete(flashcards).where(eq(flashcards.userId, userId));
  const created = [];
  for (const card of cards) {
    const result = await db.insert(flashcards).values({ userId, subjectId: effectiveSubjectId ?? null, documentId: input.documentId ?? null, front: card.front, back: card.back, sourceType: input.documentId ? "document" : "topic" });
    const id = Number(result[0].insertId);
    const stored = await db.select().from(flashcards).where(and(eq(flashcards.id, id), eq(flashcards.userId, userId))).limit(1);
    if (stored[0]) created.push(stored[0]);
  }
  return created;
}

export async function listFlashcards(userId: number) { const db = dbOrThrow(await getDb()); return db.select().from(flashcards).where(eq(flashcards.userId, userId)).orderBy(asc(flashcards.createdAt)); }
export async function reviewFlashcard(userId: number, flashcardId: number, outcome: "again" | "hard" | "good" | "easy") { const db = dbOrThrow(await getDb()); const card = await db.select({ id: flashcards.id }).from(flashcards).where(and(eq(flashcards.id, flashcardId), eq(flashcards.userId, userId))).limit(1); if (!card[0]) throw new Error("Flashcard not found."); await db.insert(flashcardReviews).values({ flashcardId, userId, outcome }); return { success: true } as const; }
export async function listQuizAttemptHistory(userId: number) { const db = dbOrThrow(await getDb()); return db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)).orderBy(asc(quizAttempts.completedAt)); }
export async function listFlashcardReviewHistory(userId: number) { const db = dbOrThrow(await getDb()); return db.select().from(flashcardReviews).where(eq(flashcardReviews.userId, userId)).orderBy(asc(flashcardReviews.reviewedAt)); }
