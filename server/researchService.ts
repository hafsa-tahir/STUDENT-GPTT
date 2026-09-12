import { and, desc, eq } from "drizzle-orm";
import { researchBriefs, researchExports, researchSources, topics } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { assertOwnedSubject, getDb } from "./db";
import { searchCommunityPerspectives } from "./serpapiService";
import { storageGetSignedUrl, storagePut } from "./storage";
import { searchResearchVideos } from "./youtubeService";

function database<T>(value: T | null): T { if (!value) throw new Error("The database connection is not available."); return value; }
function content(value: unknown) { return typeof value === "string" ? value : ""; }
function stringList(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function conceptList(value: unknown) { return Array.isArray(value) ? value.filter((item): item is { name: string; explanation: string } => Boolean(item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string" && typeof (item as { explanation?: unknown }).explanation === "string")) : []; }
function boardList(board: unknown, key: string) { return board && typeof board === "object" ? stringList((board as Record<string, unknown>)[key]) : []; }
function boardText(board: unknown, key: string) { return board && typeof board === "object" ? content((board as Record<string, unknown>)[key]) : ""; }
function exportFileName(title: string) { return `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 180) || "research-brief"}.md`; }

export type ResearchInput = { title: string; researchQuestion: string; subjectId?: number | null; topicId?: number | null };
type ExportInput = { title: string; researchQuestion: string; overview: string | null; keyConcepts: unknown; studyQuestions: unknown; actionPlan: unknown; boardContent?: unknown; sources: Array<{ title: string; url: string | null; note: string | null }>; videos: Array<{ title: string; url: string; description?: string; relevance?: string }>; community: Array<{ source: string; title: string; url: string; snippet: string }> };

export function createResearchMarkdown(input: ExportInput) {
  const board = input.boardContent;
  const section = (heading: string, values: string[]) => values.length ? ["", `## ${heading}`, ...values.map(value => `- ${value}`)] : [];
  return [
    "# " + input.title, "", "## Research question", input.researchQuestion, "", "## Research orientation", input.overview || "A synthesis has not been generated yet.",
    ...section("Project focus", boardText(board, "projectFocus") ? [boardText(board, "projectFocus")] : []),
    ...section("Objectives", boardList(board, "objectives")),
    ...section("Methodology and study approach", boardList(board, "methodology")),
    "", "## Key concepts", ...conceptList(input.keyConcepts).flatMap(concept => [`- **${concept.name}:** ${concept.explanation}`]),
    ...section("Applications and evidence to seek", boardList(board, "applications")),
    ...section("Common misconceptions", boardList(board, "misconceptions")),
    "", "## Questions to pursue", ...stringList(input.studyQuestions).map((item, index) => `${index + 1}. ${item}`),
    "", "## Study timeline", ...stringList(input.actionPlan).map((item, index) => `${index + 1}. ${item}`),
    ...section("Source-verification checklist", boardList(board, "verificationChecklist")),
    "", "## Your source desk", ...input.sources.flatMap(source => [`- ${source.title}${source.url ? ` — ${source.url}` : ""}`, source.note ? `  ${source.note}` : ""]),
    "", "## Video resources", ...input.videos.map(video => `- ${video.title} — ${video.url}${video.relevance ? `\n  Relevance: ${video.relevance}` : ""}`),
    "", "## Community perspectives", "Public Reddit and Quora results are links for further evaluation, not verified evidence.", ...input.community.map(item => `- [${item.source}] ${item.title} — ${item.url}${item.snippet ? `\n  ${item.snippet}` : ""}`),
    "", "Generated in StudentGPT. Review original sources before relying on any claim."
  ].join("\n");
}

export async function listResearchBriefs(userId: number) { const db = database(await getDb()); return db.select().from(researchBriefs).where(eq(researchBriefs.userId, userId)).orderBy(desc(researchBriefs.updatedAt)); }

export async function getResearchBrief(userId: number, briefId: number) {
  const db = database(await getDb()); const brief = await db.select().from(researchBriefs).where(and(eq(researchBriefs.id, briefId), eq(researchBriefs.userId, userId))).limit(1);
  if (!brief[0]) throw new Error("Research brief not found."); const sources = await db.select().from(researchSources).where(and(eq(researchSources.researchBriefId, briefId), eq(researchSources.userId, userId))).orderBy(desc(researchSources.createdAt)); return { brief: brief[0], sources };
}

export async function createResearchBrief(userId: number, input: ResearchInput) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId); const db = database(await getDb());
  if (input.topicId) { const topic = await db.select({ id: topics.id }).from(topics).where(and(eq(topics.id, input.topicId), eq(topics.userId, userId))).limit(1); if (!topic[0]) throw new Error("Topic not found."); }
  const result = await db.insert(researchBriefs).values({ userId, title: input.title, researchQuestion: input.researchQuestion, subjectId: input.subjectId ?? null, topicId: input.topicId ?? null }); return getResearchBrief(userId, Number(result[0].insertId));
}

export async function createResearchBriefFromTopic(userId: number, input: { topic: string; subjectId?: number | null }) {
  const topic = input.topic.trim(); return createResearchBrief(userId, { title: topic, researchQuestion: `Develop a detailed student-ready understanding of ${topic}: foundational ideas, important relationships, real applications, misconceptions, evidence worth checking, and a deliberate study sequence.`, subjectId: input.subjectId ?? null });
}

export async function addResearchSource(userId: number, briefId: number, input: { title: string; url?: string | null; note?: string | null }) {
  await getResearchBrief(userId, briefId); const db = database(await getDb()); const result = await db.insert(researchSources).values({ userId, researchBriefId: briefId, title: input.title, url: input.url ?? null, note: input.note ?? null, sourceType: "user_note" }); const stored = await db.select().from(researchSources).where(and(eq(researchSources.id, Number(result[0].insertId)), eq(researchSources.userId, userId))).limit(1); return stored[0]!;
}

export async function synthesizeResearchBrief(userId: number, briefId: number) {
  const loaded = await getResearchBrief(userId, briefId); const db = database(await getDb()); await db.update(researchBriefs).set({ status: "generating", failureReason: null }).where(and(eq(researchBriefs.id, briefId), eq(researchBriefs.userId, userId)));
  try {
    const sourceNotes = loaded.sources.length ? loaded.sources.map(source => `Source note: ${source.title}${source.url ? ` (${source.url})` : ""}\n${source.note ?? ""}`).join("\n\n") : "No user-provided source notes are available. Provide a clearly labeled general orientation; do not invent citations, statistics, or source-specific claims.";
    const response = await invokeLLM({ messages: [{ role: "system", content: "You are a careful academic research assistant and learning designer. Build a detailed project-board study brief, not a short summary. Explain connections and context in accessible academic language. Separate general orientation from claims that need verification. Never invent citations, sources, quotations, statistics, or experimental results." }, { role: "user", content: `Research title: ${loaded.brief.title}\nResearch question: ${loaded.brief.researchQuestion}\n\n${sourceNotes}\n\nCreate a rich project board. The overview must be 4–6 substantial paragraphs covering scope, background, key relationships, why the topic matters, and what must be checked in authoritative sources. Give concrete, student-actionable lists for every remaining field.` }], response_format: { type: "json_schema", json_schema: { name: "research_project_board", strict: true, schema: { type: "object", properties: { overview: { type: "string" }, keyConcepts: { type: "array", minItems: 6, maxItems: 8, items: { type: "object", properties: { name: { type: "string" }, explanation: { type: "string" } }, required: ["name", "explanation"], additionalProperties: false } }, studyQuestions: { type: "array", minItems: 6, maxItems: 8, items: { type: "string" } }, actionPlan: { type: "array", minItems: 5, maxItems: 7, items: { type: "string" } }, boardContent: { type: "object", properties: { projectFocus: { type: "string" }, objectives: { type: "array", minItems: 4, maxItems: 6, items: { type: "string" } }, methodology: { type: "array", minItems: 4, maxItems: 6, items: { type: "string" } }, applications: { type: "array", minItems: 4, maxItems: 6, items: { type: "string" } }, misconceptions: { type: "array", minItems: 4, maxItems: 6, items: { type: "string" } }, verificationChecklist: { type: "array", minItems: 4, maxItems: 6, items: { type: "string" } } }, required: ["projectFocus", "objectives", "methodology", "applications", "misconceptions", "verificationChecklist"], additionalProperties: false } }, required: ["overview", "keyConcepts", "studyQuestions", "actionPlan", "boardContent"], additionalProperties: false } } }, maxTokens: 4200 });
    const generated = JSON.parse(content(response.choices[0]?.message.content)) as { overview: string; keyConcepts: unknown[]; studyQuestions: string[]; actionPlan: string[]; boardContent: Record<string, unknown> };
    if (!generated.overview || !Array.isArray(generated.keyConcepts) || !Array.isArray(generated.studyQuestions) || !Array.isArray(generated.actionPlan) || !generated.boardContent) throw new Error("The research generator returned an invalid project board.");
    await db.update(researchBriefs).set({ status: "ready", overview: generated.overview, keyConcepts: generated.keyConcepts, studyQuestions: generated.studyQuestions, actionPlan: generated.actionPlan, boardContent: generated.boardContent, model: response.model, failureReason: null }).where(and(eq(researchBriefs.id, briefId), eq(researchBriefs.userId, userId))); return getResearchBrief(userId, briefId);
  } catch (error) { await db.update(researchBriefs).set({ status: "failed", failureReason: error instanceof Error ? error.message.slice(0, 1000) : "Research generation failed." }).where(and(eq(researchBriefs.id, briefId), eq(researchBriefs.userId, userId))); throw error; }
}

export async function exportResearchBrief(userId: number, briefId: number) {
  const loaded = await getResearchBrief(userId, briefId); const query = loaded.brief.title.slice(0, 180); const [videosResponse, communityResponse] = await Promise.allSettled([searchResearchVideos(query), searchCommunityPerspectives(query)]);
  const markdown = createResearchMarkdown({ ...loaded.brief, sources: loaded.sources, videos: videosResponse.status === "fulfilled" ? videosResponse.value : [], community: communityResponse.status === "fulfilled" ? communityResponse.value : [] }); const fileName = exportFileName(loaded.brief.title); const storedBytes = Buffer.from(markdown, "utf8"); const stored = await storagePut(`users/${userId}/research-exports/${briefId}/${Date.now()}-${fileName}`, storedBytes, "text/markdown; charset=utf-8"); const db = database(await getDb()); const result = await db.insert(researchExports).values({ userId, researchBriefId: briefId, fileName, storageKey: stored.key, mimeType: "text/markdown", byteSize: storedBytes.byteLength }); const rows = await db.select().from(researchExports).where(and(eq(researchExports.id, Number(result[0].insertId)), eq(researchExports.userId, userId))).limit(1); return { export: rows[0]!, downloadUrl: await storageGetSignedUrl(stored.key) };
}

export async function listResearchExports(userId: number, briefId: number) { await getResearchBrief(userId, briefId); const db = database(await getDb()); return db.select().from(researchExports).where(and(eq(researchExports.researchBriefId, briefId), eq(researchExports.userId, userId))).orderBy(desc(researchExports.createdAt)); }
export async function getResearchExportDownload(userId: number, exportId: number) { const db = database(await getDb()); const result = await db.select().from(researchExports).where(and(eq(researchExports.id, exportId), eq(researchExports.userId, userId))).limit(1); if (!result[0]) throw new Error("Research export not found."); return { export: result[0], downloadUrl: await storageGetSignedUrl(result[0].storageKey) }; }
export async function getResearchExportFile(userId: number, exportId: number) { const record = await getResearchExportDownload(userId, exportId); const response = await fetch(record.downloadUrl); if (!response.ok) throw new Error("The saved research document could not be retrieved."); return { fileName: record.export.fileName, mimeType: record.export.mimeType || "text/markdown", bytes: Buffer.from(await response.arrayBuffer()) }; }
