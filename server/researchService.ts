import { and, desc, eq } from "drizzle-orm";
import { researchBriefs, researchExports, researchSources, topics } from "../drizzle/schema";
import { invokeLLM, safeParseJSON } from "./_core/llm";
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
      maxTokens: 3500,
    });

    const rawContent = content(response.choices[0]?.message.content);
    const title = loaded.brief.title;
    const parsed = safeParseJSON<{ overview?: string; keyConcepts?: unknown[]; studyQuestions?: string[]; actionPlan?: string[]; boardContent?: Record<string, unknown> }>(rawContent, {});
    
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
    await db.update(researchBriefs).set({ status: "ready", overview, keyConcepts, studyQuestions, actionPlan, boardContent, model: response.model, failureReason: null }).where(and(eq(researchBriefs.id, briefId), eq(researchBriefs.userId, userId))); return getResearchBrief(userId, briefId);
  } catch (error) { await db.update(researchBriefs).set({ status: "failed", failureReason: error instanceof Error ? error.message.slice(0, 1000) : "Research generation failed." }).where(and(eq(researchBriefs.id, briefId), eq(researchBriefs.userId, userId))); throw error; }
}

export async function exportResearchBrief(userId: number, briefId: number) {
  const loaded = await getResearchBrief(userId, briefId); const query = loaded.brief.title.slice(0, 180); const [videosResponse, communityResponse] = await Promise.allSettled([searchResearchVideos(query), searchCommunityPerspectives(query)]);
  const markdown = createResearchMarkdown({ ...loaded.brief, sources: loaded.sources, videos: videosResponse.status === "fulfilled" ? videosResponse.value : [], community: communityResponse.status === "fulfilled" ? communityResponse.value : [] }); const fileName = exportFileName(loaded.brief.title); const storedBytes = Buffer.from(markdown, "utf8"); const stored = await storagePut(`users/${userId}/research-exports/${briefId}/${Date.now()}-${fileName}`, storedBytes, "text/markdown; charset=utf-8"); const db = database(await getDb()); const result = await db.insert(researchExports).values({ userId, researchBriefId: briefId, fileName, storageKey: stored.key, mimeType: "text/markdown", byteSize: storedBytes.byteLength }); const rows = await db.select().from(researchExports).where(and(eq(researchExports.id, Number(result[0].insertId)), eq(researchExports.userId, userId))).limit(1); return { export: rows[0]!, downloadUrl: await storageGetSignedUrl(stored.key) };
}

export async function listResearchExports(userId: number, briefId: number) { await getResearchBrief(userId, briefId); const db = database(await getDb()); return db.select().from(researchExports).where(and(eq(researchExports.researchBriefId, briefId), eq(researchExports.userId, userId))).orderBy(desc(researchExports.createdAt)); }
export async function getResearchExportDownload(userId: number, exportId: number) { const db = database(await getDb()); const result = await db.select().from(researchExports).where(and(eq(researchExports.id, exportId), eq(researchExports.userId, userId))).limit(1); if (!result[0]) throw new Error("Research export not found."); return { export: result[0], downloadUrl: await storageGetSignedUrl(result[0].storageKey) }; }
export async function getResearchExportFile(userId: number, exportId: number) { const record = await getResearchExportDownload(userId, exportId); const response = await fetch(record.downloadUrl); if (!response.ok) throw new Error("The saved research document could not be retrieved."); return { fileName: record.export.fileName, mimeType: record.export.mimeType || "text/markdown", bytes: Buffer.from(await response.arrayBuffer()) }; }
