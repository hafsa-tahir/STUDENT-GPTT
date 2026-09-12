import { and, desc, eq, like } from "drizzle-orm";
import { documentChunks, documents, revisionGuides, stickyNotes, studyNotes } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { assertOwnedSubject, getDb } from "./db";

function database<T>(value: T | null): T { if (!value) throw new Error("The database connection is not available."); return value; }
function text(value: unknown) { return typeof value === "string" ? value : ""; }
type ScopeType = "topic" | "chapter" | "section" | "range" | "document";
type SourceInput = { topic?: string | null; subjectId?: number | null; documentId?: number | null; scopeType: ScopeType; scopeLabel: string };

async function ownedSource(userId: number, input: SourceInput) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  if (!input.documentId) return `Student topic: ${input.topic || input.scopeLabel}\nRequested scope: ${input.scopeLabel}`;
  const db = database(await getDb());
  const document = await db.select().from(documents).where(and(eq(documents.id, input.documentId), eq(documents.userId, userId), eq(documents.status, "ready"))).limit(1);
  if (!document[0]) throw new Error("Document not found.");
  const matching = await db.select().from(documentChunks).where(and(eq(documentChunks.documentId, input.documentId), eq(documentChunks.userId, userId), like(documentChunks.content, `%${input.scopeLabel}%`))).limit(14);
  const chunks = matching.length ? matching : await db.select().from(documentChunks).where(and(eq(documentChunks.documentId, input.documentId), eq(documentChunks.userId, userId))).limit(18);
  return `Book: ${document[0].originalName}\nRequested ${input.scopeType}: ${input.scopeLabel}\n\n${chunks.map(chunk => chunk.content).join("\n\n").slice(0, 24000)}`;
}

export async function listStudyNotes(userId: number) { const db = database(await getDb()); return db.select().from(studyNotes).where(eq(studyNotes.userId, userId)).orderBy(desc(studyNotes.updatedAt)); }
export async function getStudyNote(userId: number, noteId: number) { const db = database(await getDb()); const note = await db.select().from(studyNotes).where(and(eq(studyNotes.id, noteId), eq(studyNotes.userId, userId))).limit(1); if (!note[0]) throw new Error("Study note not found."); const stickies = await db.select().from(stickyNotes).where(and(eq(stickyNotes.studyNoteId, noteId), eq(stickyNotes.userId, userId))).orderBy(desc(stickyNotes.updatedAt)); return { note: note[0], stickyNotes: stickies }; }

export async function generateStudyNotes(userId: number, input: SourceInput & { title: string }) {
  const source = await ownedSource(userId, input);
  const response = await invokeLLM({ messages: [{ role: "system", content: "Create clear and strictly source-grounded academic notes. Use a hierarchy of headings and bullets, explain difficult ideas in simple terms, and do not invent content absent from the supplied material." }, { role: "user", content: `Create polished study notes titled '${input.title}' for the requested ${input.scopeType}: '${input.scopeLabel}'. Include a concise overview, four to seven headed sections with key bullets, and three revision reminders.\n\n${source}` }], response_format: { type: "json_schema", json_schema: { name: "study_notes", strict: true, schema: { type: "object", properties: { overview: { type: "string" }, sections: { type: "array", minItems: 4, maxItems: 7, items: { type: "object", properties: { heading: { type: "string" }, explanation: { type: "string" }, bullets: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } } }, required: ["heading", "explanation", "bullets"], additionalProperties: false } }, revisionReminders: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } } }, required: ["overview", "sections", "revisionReminders"], additionalProperties: false } } }, maxTokens: 2800 });
  const content = JSON.parse(text(response.choices[0]?.message.content)) as { overview: string; sections: unknown[]; revisionReminders: string[] };
  if (!content.overview || !Array.isArray(content.sections) || !Array.isArray(content.revisionReminders)) throw new Error("The notes generator returned an invalid result.");
  const db = database(await getDb()); const inserted = await db.insert(studyNotes).values({ userId, subjectId: input.subjectId ?? null, documentId: input.documentId ?? null, title: input.title, scopeType: input.scopeType, scopeLabel: input.scopeLabel, content, model: response.model }); return getStudyNote(userId, Number(inserted[0].insertId));
}

export async function addStickyNote(userId: number, studyNoteId: number, input: { content: string; color: string }) { await getStudyNote(userId, studyNoteId); const db = database(await getDb()); const inserted = await db.insert(stickyNotes).values({ userId, studyNoteId, content: input.content, color: input.color }); const stored = await db.select().from(stickyNotes).where(and(eq(stickyNotes.id, Number(inserted[0].insertId)), eq(stickyNotes.userId, userId))).limit(1); return stored[0]!; }

export async function generateRevisionGuide(userId: number, input: SourceInput & { title: string }) {
  const source = await ownedSource(userId, input);
  const response = await invokeLLM({ messages: [{ role: "system", content: "Create a pragmatic academic revision guide only from the supplied study source. It should prioritize retrieval practice, misconceptions, and short focused sessions." }, { role: "user", content: `Create a revision guide titled '${input.title}' for '${input.scopeLabel}'. Return a short overview, four to six revision blocks, and an end-of-session self-check list.\n\n${source}` }], response_format: { type: "json_schema", json_schema: { name: "revision_guide", strict: true, schema: { type: "object", properties: { overview: { type: "string" }, blocks: { type: "array", minItems: 4, maxItems: 6, items: { type: "object", properties: { title: { type: "string" }, focus: { type: "string" }, questions: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } } }, required: ["title", "focus", "questions"], additionalProperties: false } }, selfCheck: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } } }, required: ["overview", "blocks", "selfCheck"], additionalProperties: false } } }, maxTokens: 2400 });
  const content = JSON.parse(text(response.choices[0]?.message.content));
  const db = database(await getDb()); const inserted = await db.insert(revisionGuides).values({ userId, subjectId: input.subjectId ?? null, documentId: input.documentId ?? null, title: input.title, scopeLabel: input.scopeLabel, content, model: response.model }); const stored = await db.select().from(revisionGuides).where(and(eq(revisionGuides.id, Number(inserted[0].insertId)), eq(revisionGuides.userId, userId))).limit(1); return stored[0]!;
}

export async function listRevisionGuides(userId: number) { const db = database(await getDb()); return db.select().from(revisionGuides).where(eq(revisionGuides.userId, userId)).orderBy(desc(revisionGuides.createdAt)); }
