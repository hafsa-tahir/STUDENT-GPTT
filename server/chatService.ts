import { and, asc, desc, eq } from "drizzle-orm";
import { aiRequests, conversations, documentChunks, documents, messageSources, messages, usageCounters } from "../drizzle/schema";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { assertOwnedSubject, getDb } from "./db";

const MONTHLY_CHAT_LIMIT = 300;
const modes = ["explain", "teach", "simplify", "examples", "step_by_step", "quiz_me", "practice", "exam_prep"] as const;
type LearningMode = (typeof modes)[number];

function requireDatabase<T>(database: T | null): T {
  if (!database) throw new Error("The database connection is not available.");
  return database;
}

function currentPeriod() { return new Date().toISOString().slice(0, 7); }

function studentSystemPrompt(mode: LearningMode) {
  const directions: Record<LearningMode, string> = {
    explain: "Explain clearly with short sections, definitions, and one helpful example.",
    teach: "Teach with a scaffolded explanation, checking assumptions before moving to harder detail.",
    simplify: "Use plain language, short sentences, and a concise analogy when useful.",
    examples: "Lead with worked examples, then extract the general method.",
    step_by_step: "Break the answer into numbered reasoning steps without inventing facts.",
    quiz_me: "Use a Socratic style: ask one focused question at a time and wait for the student's answer.",
    practice: "Give practice-oriented guidance, show a method, and leave a small part for the student to attempt.",
    exam_prep: "Prioritize exam-relevant concepts, common mistakes, and a compact recall checklist.",
  };
  return `You are StudentGPT, an academically careful learning assistant. ${directions[mode]} Use Markdown when it improves readability. State uncertainty instead of fabricating sources or claims. Never claim to have read a document unless document context was supplied.`;
}

function getText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part): part is { type: "text"; text: string } => typeof part === "object" && part !== null && "type" in part && "text" in part && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string")
    .map(part => part.text)
    .join("\n");
}

async function reserveChatRequest(userId: number) {
  const db = requireDatabase(await getDb());
  const periodKey = currentPeriod();
  const existing = await db.select().from(usageCounters).where(and(eq(usageCounters.userId, userId), eq(usageCounters.periodKey, periodKey))).limit(1);
  const counter = existing[0];
  if (counter && counter.chatRequests >= MONTHLY_CHAT_LIMIT) {
    await db.insert(aiRequests).values({ userId, feature: "chat", status: "rate_limited", promptTokens: 0, completionTokens: 0, errorCode: "monthly_chat_limit" });
    throw new Error("Your monthly chat allowance has been reached. Please return next month.");
  }
  if (counter) await db.update(usageCounters).set({ chatRequests: counter.chatRequests + 1 }).where(eq(usageCounters.id, counter.id));
  else await db.insert(usageCounters).values({ userId, periodKey, chatRequests: 1, generatedTokens: 0, uploadBytes: 0 });
  return periodKey;
}

export async function listChatConversations(userId: number) {
  const db = requireDatabase(await getDb());
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
}

export async function getChatConversation(userId: number, conversationId: number) {
  const db = requireDatabase(await getDb());
  const conversation = await db.select().from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId))).limit(1);
  if (!conversation[0]) throw new Error("Conversation not found.");
  const history = await db.select().from(messages).where(and(eq(messages.conversationId, conversationId), eq(messages.userId, userId))).orderBy(asc(messages.createdAt));
  return { conversation: conversation[0], messages: history };
}

export async function createChatConversation(userId: number, input: { title?: string; learningMode: LearningMode; subjectId?: number | null }) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  const db = requireDatabase(await getDb());
  const result = await db.insert(conversations).values({ userId, title: input.title?.trim() || "New study conversation", learningMode: input.learningMode, subjectId: input.subjectId ?? null });
  const id = Number(result[0].insertId);
  const created = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId))).limit(1);
  return created[0]!;
}

async function retrieveDocumentContext(userId: number, documentId: number, query: string) {
  const db = requireDatabase(await getDb());
  const document = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId), eq(documents.status, "ready"))).limit(1);
  if (!document[0]) throw new Error("Document not found.");
  const chunks = await db.select().from(documentChunks).where(and(eq(documentChunks.documentId, documentId), eq(documentChunks.userId, userId))).limit(250);
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3).slice(0, 12);
  const ranked = chunks.map(chunk => ({ chunk, score: terms.reduce((total, term) => total + (chunk.content.toLowerCase().includes(term) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex).slice(0, 6).map(result => result.chunk);
  return { document: document[0], chunks: ranked };
}

export async function sendChatMessage(userId: number, input: { conversationId: number; content: string; documentId?: number }) {
  const db = requireDatabase(await getDb());
  const loaded = await getChatConversation(userId, input.conversationId);
  await reserveChatRequest(userId);
  const started = Date.now();
  const requestResult = await db.insert(aiRequests).values({ userId, feature: "chat", status: "started", promptTokens: 0, completionTokens: 0 });
  const requestId = Number(requestResult[0].insertId);
  await db.insert(messages).values({ conversationId: loaded.conversation.id, userId, role: "user", content: input.content, generationStatus: "complete" });
  const history = [...loaded.messages.map(message => ({ role: message.role, content: message.content })), { role: "user" as const, content: input.content }];
  try {
    const grounding = input.documentId ? await retrieveDocumentContext(userId, input.documentId, input.content) : null;
    const documentInstruction = grounding ? `The student selected the private document “${grounding.document.originalName}”. Answer only using the excerpts below for document-specific claims. Cite the source name in brackets whenever relying on it. If the excerpts do not answer the question, say so.\n\n${grounding.chunks.map((chunk, index) => `[Excerpt ${index + 1}] ${chunk.content}`).join("\n\n")}` : "";
    const result = await invokeLLM({ messages: [{ role: "system", content: studentSystemPrompt(loaded.conversation.learningMode as LearningMode) }, ...(documentInstruction ? [{ role: "system" as const, content: documentInstruction }] : []), ...history], maxTokens: 1200 });
    const assistantContent = getText(result.choices[0]?.message.content ?? "I could not generate a response.");
    const assistantResult = await db.insert(messages).values({ conversationId: loaded.conversation.id, userId, role: "assistant", content: assistantContent, model: result.model, generationStatus: "complete" });
    const assistantId = Number(assistantResult[0].insertId);
    if (grounding) {
      for (const chunk of grounding.chunks) await db.insert(messageSources).values({ messageId: assistantId, documentId: grounding.document.id, documentChunkId: chunk.id, userId, citationLabel: grounding.document.originalName, pageStart: chunk.pageStart ?? null, pageEnd: chunk.pageEnd ?? null });
    }
    const usage = result.usage;
    await db.update(aiRequests).set({ status: "complete", model: result.model, promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0, latencyMs: Date.now() - started }).where(eq(aiRequests.id, requestId));
    if (usage?.completion_tokens) {
      const period = currentPeriod();
      const counter = await db.select().from(usageCounters).where(and(eq(usageCounters.userId, userId), eq(usageCounters.periodKey, period))).limit(1);
      if (counter[0]) await db.update(usageCounters).set({ generatedTokens: counter[0].generatedTokens + usage.completion_tokens }).where(eq(usageCounters.id, counter[0].id));
    }
    if (loaded.messages.length === 0 && loaded.conversation.title === "New study conversation") {
      await db.update(conversations).set({ title: input.content.slice(0, 72) }).where(and(eq(conversations.id, loaded.conversation.id), eq(conversations.userId, userId)));
    }
    const stored = await db.select().from(messages).where(and(eq(messages.id, assistantId), eq(messages.userId, userId))).limit(1);
    return stored[0]!;
  } catch (error) {
    await db.update(aiRequests).set({ status: "failed", latencyMs: Date.now() - started, errorCode: "model_request_failed" }).where(eq(aiRequests.id, requestId));
    throw error;
  }
}

export async function regenerateChatMessage(userId: number, conversationId: number) {
  const loaded = await getChatConversation(userId, conversationId);
  const lastUser = [...loaded.messages].reverse().find(message => message.role === "user");
  if (!lastUser) throw new Error("There is no message to regenerate.");
  return sendChatMessage(userId, { conversationId, content: lastUser.content });
}

export async function availableChatModels() {
  const catalog = await listLLMModels();
  return catalog.data.map(model => ({ id: model.id }));
}
