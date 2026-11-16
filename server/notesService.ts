import { and, asc, desc, eq, like } from "drizzle-orm";
import { documentChunks, documents, revisionGuides, stickyNotes, studyNotes } from "../drizzle/schema";
import { invokeLLM, safeParseJSON } from "./_core/llm";
import { assertOwnedSubject, getDb } from "./db";

function database<T>(value: T | null): T {
  if (!value) throw new Error("The database connection is not available.");
  return value;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

type ScopeType = "topic" | "chapter" | "section" | "range" | "document";
type SourceInput = {
  topic?: string | null;
  subjectId?: number | null;
  documentId?: number | null;
  scopeType: ScopeType;
  scopeLabel: string;
};

export interface ResolvedSource {
  docId: number | null;
  docName: string;
  originalName: string;
  scopeLabel: string;
  scopeType: ScopeType;
  fullText: string;
  promptContext: string;
}

export async function resolveOwnedSource(userId: number, input: SourceInput): Promise<ResolvedSource> {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  const db = database(await getDb());

  const docId = input.documentId;

  if (!docId) {
    const fallbackTopic = input.topic || input.scopeLabel || "Academic Subject";
    return {
      docId: null,
      docName: fallbackTopic,
      originalName: fallbackTopic,
      scopeLabel: input.scopeLabel || fallbackTopic,
      scopeType: input.scopeType,
      fullText: "",
      promptContext: `Student Topic: ${fallbackTopic}\nRequested Scope: ${input.scopeType} — ${input.scopeLabel}`
    };
  }

  const document = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.userId, userId), eq(documents.status, "ready")))
    .limit(1);

  if (!document[0]) {
    throw new Error("The selected PDF document could not be found or is not ready.");
  }

  const rawName = document[0].originalName || "Document";
  const cleanDocName = rawName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();

  const isWhole =
    input.scopeType === "document" ||
    !input.scopeLabel ||
    input.scopeLabel.trim().toLowerCase() === "whole" ||
    input.scopeLabel.trim().toLowerCase() === "all" ||
    input.scopeLabel.trim().toLowerCase().includes("complete") ||
    input.scopeLabel.trim().toLowerCase().includes("whole book") ||
    input.scopeLabel.trim().toLowerCase().includes("all chapters");

  let chunks: Array<{ chunkIndex: number; content: string; sectionLabel?: string | null }> = [];

  if (isWhole) {
    // When whole document is requested, load all sequential chunks in ascending order
    chunks = await db
      .select({
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        sectionLabel: documentChunks.sectionLabel
      })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, docId))
      .orderBy(asc(documentChunks.chunkIndex))
      .limit(50);
  } else {
    // Look for matching chunks based on chapter/section keyword
    const label = input.scopeLabel.trim();
    const matching = await db
      .select({
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        sectionLabel: documentChunks.sectionLabel
      })
      .from(documentChunks)
      .where(and(eq(documentChunks.documentId, docId), like(documentChunks.content, `%${label}%`)))
      .orderBy(asc(documentChunks.chunkIndex))
      .limit(20);

    if (matching.length > 0) {
      chunks = matching;
    } else {
      // If no exact substring match, load chronological chunks so LLM has real text rather than empty content
      chunks = await db
        .select({
          chunkIndex: documentChunks.chunkIndex,
          content: documentChunks.content,
          sectionLabel: documentChunks.sectionLabel
        })
        .from(documentChunks)
        .where(eq(documentChunks.documentId, docId))
        .orderBy(asc(documentChunks.chunkIndex))
        .limit(30);
    }
  }

  let contentText = "";
  const fullExtracted = ((document[0] as any).extractedText || "").trim();

  if (isWhole && fullExtracted.length > 100) {
    // Use continuous, un-chopped extractedText for complete A-to-Z document coverage
    contentText = fullExtracted;
  } else {
    // Merge chunks while stripping 180-char overlaps and broken leading mid-word fragments
    const mergedParts: string[] = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      let chunkStr = chunks[idx].content.trim();
      if (idx > 0 && mergedParts.length > 0) {
        const prev = mergedParts[mergedParts.length - 1];
        const tail = prev.slice(-220);
        const overlapCheck = chunkStr.slice(0, 60);
        const overlapPos = tail.indexOf(overlapCheck.slice(0, 25));
        if (overlapPos !== -1) {
          const overlapLen = tail.length - overlapPos;
          chunkStr = chunkStr.slice(overlapLen).trim();
        } else if (/^[a-z]{1,6}\s+/.test(chunkStr)) {
          // Strip broken mid-word fragment at start of chunk
          chunkStr = chunkStr.replace(/^[a-z]{1,6}\s+/, "");
        }
      }
      if (chunkStr) mergedParts.push(chunkStr);
    }
    contentText = mergedParts.join("\n\n").trim();
    if (!contentText) contentText = fullExtracted;
  }

  // Clean common scan/PDF headers and spaced-out slide watermarks
  contentText = contentText
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
    .replace(/\bD\s+E\s+F\s+I\s+N\s+I\s+T\s+I\s+O\s+N\b/g, "DEFINITION:")
    .replace(/\bK\s+E\s+Y\s+F\s+O\s+R\s+M\s+U\s+L\s+A\b/g, "KEY FORMULA:")
    .replace(/\bW\s+O\s+R\s+K\s+E\s+D\s+E\s+X\s+A\s+M\s+P\s+L\s+E\b/g, "WORKED EXAMPLE:")
    .replace(/\bE\s+X\s+A\s+M\s+T\s+I\s+P\b/g, "EXAM TIP:")
    .trim();

  const promptContext = `Document Name: ${document[0].originalName} (${cleanDocName})
Requested Study Scope: ${input.scopeType} - ${isWhole ? "Complete Document From Start to Finish (A to Z)" : input.scopeLabel}

STRICT BOUNDING RULE: You MUST generate notes ONLY from the provided document content below. Cover the ENTIRE document thoroughly from beginning to end (A to Z) without skipping any section, formula, derivation, or worked example. Do NOT invent outside topics.

FULL DOCUMENT CONTENT (Read thoroughly from start to finish):
${contentText.slice(0, 32000)}`;

  return {
    docId,
    docName: cleanDocName,
    originalName: document[0].originalName,
    scopeLabel: isWhole ? "Complete Document" : input.scopeLabel,
    scopeType: input.scopeType,
    fullText: contentText,
    promptContext
  };
}

export async function listStudyNotes(userId: number, subjectId?: number | null) {
  const db = database(await getDb());
  const conditions = [eq(studyNotes.userId, userId)];
  if (typeof subjectId === "number" && subjectId > 0) {
    conditions.push(eq(studyNotes.subjectId, subjectId));
  }
  return db.select().from(studyNotes).where(and(...conditions)).orderBy(desc(studyNotes.updatedAt));
}

export async function getStudyNote(userId: number, noteId: number) {
  const db = database(await getDb());
  const note = await db
    .select()
    .from(studyNotes)
    .where(and(eq(studyNotes.id, noteId), eq(studyNotes.userId, userId)))
    .limit(1);
  if (!note[0]) throw new Error("Study note not found.");
  const stickies = await db
    .select()
    .from(stickyNotes)
    .where(and(eq(stickyNotes.studyNoteId, noteId), eq(stickyNotes.userId, userId)))
    .orderBy(desc(stickyNotes.updatedAt));
  return { note: note[0], stickyNotes: stickies };
}

function parseRealAcademicNotes(fullText: string, docName: string) {
  // Thoroughly strip slide headers, watermarks, footers, and page numbers
  const clean = fullText
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
    .replace(/Page\s+\d+\s+of\s+\d+/gi, "")
    .replace(/\b\d+\s+of\s+\d+\b/gi, "")
    .replace(/Department of Physics[^\n\r|]*[|·-]?/gi, "")
    .replace(/University of[^\n\r|]*[|·-]?/gi, "")
    .replace(/Electric Charge and Coulomb's Law[^\n\r]*/gi, "")
    .replace(/Electric Field Lines and (?:the )?Electric Dipole/gi, "")
    .replace(/\b[A-Z\s]{2,}\s*·\s*[A-Z\s]{2,}\b/g, "") // Slide category breadcrumbs like "P A R T 1 · F I E L D L I N E S"
    .replace(/\b(?:P\s*A\s*R\s*T|Part)\s*\d+[:·\-–\.]?\s*/gi, "")
    .replace(/\r\n/g, "\n");

  const paragraphs = clean
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s+/g, " ").trim())
    .filter(p => p.length > 35 && !p.toLowerCase().includes("student notes") && !/^\d+$/.test(p));

  const sections: Array<{ heading: string; explanation: string; bullets: string[] }> = [];
  const seenSentences = new Set<string>();

  for (let i = 0; i < Math.min(paragraphs.length, 10); i++) {
    const p = paragraphs[i];
    const rawSentences = p
      .split(/(?<=[.!?])\s+/)
      .map(s => s.replace(/^[a-z]{1,6}\s+/, "").trim())
      .filter(s => s.length > 25 && !seenSentences.has(s.toLowerCase()));

    if (rawSentences.length === 0) continue;

    for (const s of rawSentences) {
      seenSentences.add(s.toLowerCase());
    }

    const secHeadingMatch = p.match(/\b(\d+\.\d+\s+[A-Za-z][A-Za-z\s&'-]{3,45})/);
    const heading = secHeadingMatch
      ? secHeadingMatch[1].trim()
      : `${docName} — Section ${sections.length + 1}`;
    const explanation = rawSentences[0];
    const bullets = rawSentences.slice(1, 7);

    sections.push({
      heading,
      explanation: explanation.slice(0, 450),
      bullets: (bullets.length > 0 ? bullets : [explanation]).map(b => b.slice(0, 320))
    });
  }

  if (sections.length < 3) {
    sections.push({
      heading: `${docName} Core Concepts`,
      explanation: `Core academic principles and foundational mechanisms for ${docName}.`,
      bullets: [
        `Fundamental definitions and governing physical/theoretical principles`,
        `Primary equations, quantitative relations, and boundary conditions`,
        `Practical applications and common academic problem-solving techniques`
      ]
    });
  }

  return sections;
}

function normalizeNotesContent(raw: unknown, source: ResolvedSource) {
  const docName = source.docName || "Study Material";
  const defaultOverview = `Academic study notes covering key concepts, foundational principles, and core topics for ${docName}.`;

  const isGenericSection = (heading: string, bullets: string[]) => {
    const h = heading.toLowerCase();
    if (
      h.includes("core overview & fundamental concepts") ||
      h.includes("key analysis & theoretical structure") ||
      h.includes("practical applications & system context") ||
      h.includes("synthesis & key takeaways") ||
      h.includes("core overview & key principles") ||
      h.includes("structural breakdown & methodology") ||
      h.includes("notes: whole")
    ) return true;

    const bText = bullets.join(" ").toLowerCase();
    if (
      bText.includes("primary terminology and baseline concepts governing") ||
      bText.includes("essential definitions, primary objectives, and foundational context") ||
      bText.includes("critical formulas, processes, or logical workflows") ||
      bText.includes("summary of critical insights and high-yield concepts")
    ) return true;

    return false;
  };

  if (!raw || typeof raw !== "object") {
    const derivedSections = parseRealAcademicNotes(source.fullText, docName);
    return {
      overview: defaultOverview,
      sections: derivedSections,
      revisionReminders: [
        `Review key definitions and core mechanisms for ${docName}`,
        `Test active recall on primary section headings and formulas`,
        `Synthesize central theorems and practical applications in your own words`
      ]
    };
  }

  const obj = raw as Record<string, any>;
  const target = obj.notes || obj.study_notes || obj.result || obj.data || obj;

  let overview =
    typeof target.overview === "string" && target.overview.trim().length > 25
      ? target.overview.trim()
      : typeof target.summary === "string" && target.summary.trim().length > 25
        ? target.summary.trim()
        : defaultOverview;

  let sections: Array<{ heading: string; explanation: string; bullets: string[] }> = [];
  const rawSections = Array.isArray(target.sections)
    ? target.sections
    : Array.isArray(target.topics)
      ? target.topics
      : Array.isArray(target.content_sections)
        ? target.content_sections
        : [];

  for (const item of rawSections) {
    if (item && typeof item === "object") {
      const heading =
        typeof item.heading === "string" && item.heading.trim()
          ? item.heading.trim()
          : typeof item.title === "string" && item.title.trim()
            ? item.title.trim()
            : "Key Concept";
      const explanation =
        typeof item.explanation === "string" && item.explanation.trim()
          ? item.explanation.trim()
          : typeof item.description === "string" && item.description.trim()
            ? item.description.trim()
            : "Detailed academic explanation.";
      const bullets = Array.isArray(item.bullets)
        ? item.bullets.map((b: unknown) => String(b).trim()).filter(Boolean)
        : Array.isArray(item.points)
          ? item.points.map((p: unknown) => String(p).trim()).filter(Boolean)
          : ["Fundamental concept detail."];

      if (!isGenericSection(heading, bullets) && bullets.length > 0) {
        sections.push({ heading, explanation, bullets });
      }
    }
  }

  // If LLM returned generic boilerplate or nothing, immediately use real parsed academic notes from source text!
  if (sections.length === 0 && source.fullText) {
    sections = parseRealAcademicNotes(source.fullText, docName);
  }

  let revisionReminders: string[] = [];
  const rawReminders = Array.isArray(target.revisionReminders)
    ? target.revisionReminders
    : Array.isArray(target.reminders)
      ? target.reminders
      : Array.isArray(target.revision_reminders)
        ? target.revision_reminders
        : [];

  if (rawReminders.length >= 2) {
    revisionReminders = rawReminders.map((r: unknown) => String(r).trim()).filter(Boolean);
  } else {
    revisionReminders = [
      `Master core terminology and fundamental equations from ${docName}`,
      `Test active recall on primary section headings and mechanisms`,
      `Explain key differentiation points and worked examples without looking at notes`
    ];
  }

  return { overview, sections, revisionReminders };
}

export async function generateStudyNotes(userId: number, input: SourceInput & { title: string }) {
  const source = await resolveOwnedSource(userId, input);

  // Derive an accurate, professional title
  let cleanTitle = input.title;
  if (!cleanTitle || cleanTitle.toLowerCase() === "notes: whole" || cleanTitle.toLowerCase() === "notes: complete" || cleanTitle.includes(": whole")) {
    cleanTitle = `${source.docName} — Comprehensive Study Notes`;
  } else if (!cleanTitle.includes(source.docName) && source.docName !== "Academic Subject") {
    cleanTitle = `${source.docName}: ${input.scopeLabel || "Study Notes"}`;
  }

  const systemPrompt = `You are a distinguished academic professor and master notes author. 
Your objective is to produce exhaustive, fully comprehensive, and rigorous academic study notes based entirely on the provided document text.

CRITICAL INSTRUCTIONS:
1. EXHAUSTIVE COVERAGE: Read the provided document text completely. Include EVERY key concept, definition, mechanism, formula, equation, theorem, process, principle, and worked example present in the text. No significant concept or detail from the source text should be omitted.
2. STRUCTURED BY TOPIC/HEADING: Organize the notes into clear, logical, sequential sections corresponding to the headings, parts, and themes in the document.
3. IN-DEPTH EXPLANATIONS: For each section, provide a thorough, articulate academic explanation (not just a one-liner).
4. MATHEMATICAL DERIVATIONS & FORMULAS (LIKE CHATGPT / CLAUDE):
   - Typeset all mathematical and physics expressions using standard LaTeX delimiters:
     * Inline math: use single dollar signs, e.g., $q = n e$, $\tau = \vec{p} \times \vec{E}$, $U = -\vec{p} \cdot \vec{E}$.
     * Key equations & derivations: use display math with double dollar signs on separate lines, e.g.:
       $$E_{\text{axis}} = \frac{2kqd}{(z^2 - d^2/4)^2} \approx \frac{2kp}{z^3} \quad (z \gg d)$$
   - For mathematical derivations or worked problems, present them step-by-step:
     * Step 1: Starting fundamental law or setup equation
     * Step 2: Component breakdown or geometric symmetry (which components cancel vs add)
     * Step 3: Algebraic steps with intermediate substitutions
     * Step 4: Far-field approximations or boundary conditions
     * Step 5: Final boxed/highlighted result with direction and SI units
   - NEVER output messy unspaced equations or run-on algebra blobs. Always write lucid, well-spaced derivations.
5. DETAILED BULLET POINTS: Under each section, include detailed, high-yield bullet points capturing formulas, nuances, quantitative values, steps, and exact terminology from the text.
6. GROUNDED IN TRUTH: Rely strictly on the supplied document. Do not invent details. Do not use generic template filler or phrases like "Notes: whole".
7. RETURN VALID JSON: Return a JSON object with:
   - "overview": A thorough 2-3 paragraph academic overview of the entire material.
   - "sections": An array of 4 to 10 detailed sections, each with:
     - "heading": The specific academic heading or topic name from the text
     - "explanation": Comprehensive, lucid explanation of the principles and derivations
     - "bullets": Array of 3 to 8 detailed bullets with formulas, mechanisms, and key facts
   - "revisionReminders": Array of 3 to 5 high-yield active recall questions or reminders to test mastery.`;

  const userPrompt = `Create complete, highly structured study notes titled '${cleanTitle}' covering the requested scope: '${source.scopeLabel}'.

Make sure every heading, definition, formula, and conceptual mechanism from the source text below is thoroughly captured:

${source.promptContext}`;

  let content;
  let modelUsed = "studentgpt-academic-engine";

  const fullDocText = (source.fullText || "").trim();
  const segmentSize = 3600;
  const rawSegments: string[] = [];
  if (fullDocText.length > segmentSize) {
    for (let pos = 0; pos < Math.min(fullDocText.length, 25000); pos += segmentSize) {
      const slice = fullDocText.slice(pos, pos + segmentSize).trim();
      if (slice.length > 80) rawSegments.push(slice);
    }
  } else if (fullDocText.length > 0) {
    rawSegments.push(fullDocText);
  }

  if (rawSegments.length > 1) {
    const mergedSections: Array<{ heading: string; explanation: string; bullets: string[] }> = [];
    const mergedReminders: string[] = [];
    let combinedOverview = "";

    for (let idx = 0; idx < rawSegments.length; idx++) {
      const segText = rawSegments[idx];
      const segPrompt = `Document Name: ${source.originalName} (${source.docName})
Part ${idx + 1} of ${rawSegments.length} (Exhaustive Word-by-Word Section Coverage):
Read this part of the document completely. Capture EVERY heading, definition, constant, formula ($...$ and $$...$$), step-by-step derivation, and worked example in this part. Do NOT summarize briefly—write detailed, textbook-quality notes!

Return ONLY a valid JSON object with:
- "overview": "${idx === 0 ? "Write a thorough 4-sentence academic overview of this document" : "Write a 2-sentence summary of this part"}"
- "sections": Array of 2 to 4 exhaustive sections covering every topic in this part, each with:
  * "heading": Specific section/topic title from the text
  * "explanation": Detailed 4-to-6 sentence explanation explaining the theory, physical/logical intuition, and step-by-step derivations in this section
  * "bullets": Array of 5 to 8 detailed, full-sentence bullet points containing every definition, formula, unit, worked example calculation, and exam tip from this section
- "revisionReminders": Array of 2 active recall questions from this part

DOCUMENT PART ${idx + 1} CONTENT:
${segText}`;

      try {
        const segResp = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: segPrompt }
          ],
          response_format: { type: "json_object" },
          maxTokens: 1200
        });
        if (segResp?.model) modelUsed = segResp.model;
        const parsedSeg = safeParseJSON<Record<string, any>>(text(segResp?.choices?.[0]?.message?.content), {});
        const normalizedSeg = normalizeNotesContent(parsedSeg, source);
        if (idx === 0 && normalizedSeg.overview) {
          combinedOverview = normalizedSeg.overview;
        }
        for (const sec of normalizedSeg.sections) {
          if (!mergedSections.some(existing => existing.heading.toLowerCase() === sec.heading.toLowerCase())) {
            mergedSections.push(sec);
          }
        }
        for (const rem of normalizedSeg.revisionReminders) {
          if (mergedReminders.length < 6 && !mergedReminders.includes(rem)) {
            mergedReminders.push(rem);
          }
        }
      } catch (segErr) {
        console.warn(`Segment ${idx + 1}/${rawSegments.length} failed in generateStudyNotes:`, segErr);
      }
    }

    if (mergedSections.length > 0) {
      content = {
        overview: combinedOverview || `Exhaustive A-to-Z study notes for ${source.docName}, covering all ${rawSegments.length} parts of the document from start to finish.`,
        sections: mergedSections,
        revisionReminders: mergedReminders.length >= 2 ? mergedReminders : [
          `Review all definitions, formulas, and derivations across ${source.docName}`,
          `Re-work every solved problem from Part 1 through Part ${rawSegments.length} without looking at the solution`
        ]
      };
    }
  }

  if (!content) {
    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        maxTokens: 1250
      });

      const parsedRaw = safeParseJSON<unknown>(text(response?.choices?.[0]?.message?.content), {});
      content = normalizeNotesContent(parsedRaw, source);
      if (response?.model) modelUsed = response.model;
    } catch (err) {
      console.warn("LLM invoke failed in generateStudyNotes; using authentic document extractor:", err);
      content = normalizeNotesContent({}, source);
    }
  }

  const db = database(await getDb());
  let targetSubjectId = input.subjectId ?? null;
  const docId = source.docId ?? input.documentId ?? null;
  if (!targetSubjectId && docId) {
    try {
      const docRow = await db.select({ subjectId: documents.subjectId }).from(documents).where(eq(documents.id, docId)).limit(1);
      if (docRow[0]?.subjectId) targetSubjectId = docRow[0].subjectId;
    } catch {}
  }
  const inserted = await db.insert(studyNotes).values({
    userId,
    subjectId: targetSubjectId,
    documentId: docId,
    title: cleanTitle,
    scopeType: source.scopeType,
    scopeLabel: source.scopeLabel,
    content,
    model: modelUsed || "studentgpt-notes-engine"
  });

  return getStudyNote(userId, Number(inserted[0].insertId));
}

export async function addStickyNote(
  userId: number,
  studyNoteId: number,
  input: { content: string; color: string }
) {
  await getStudyNote(userId, studyNoteId);
  const db = database(await getDb());
  const inserted = await db.insert(stickyNotes).values({
    userId,
    studyNoteId,
    content: input.content,
    color: input.color
  });
  const stored = await db
    .select()
    .from(stickyNotes)
    .where(and(eq(stickyNotes.id, Number(inserted[0].insertId)), eq(stickyNotes.userId, userId)))
    .limit(1);
  return stored[0]!;
}

export async function generateRevisionGuide(userId: number, input: SourceInput & { title: string }) {
  const source = await resolveOwnedSource(userId, input);

  let cleanTitle = input.title;
  if (!cleanTitle || cleanTitle.toLowerCase() === "revision: whole" || cleanTitle.includes(": whole")) {
    cleanTitle = `${source.docName} — Revision Guide`;
  }

  const revContext = source.promptContext.slice(0, 14000);
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an elite academic revision specialist. Transform the supplied document into a high-yield revision sheet strictly grounded ONLY in the provided document text. Do NOT mix in any outside topics or other documents.

Return ONLY a valid JSON object with:
1. "oneLineSummary": A single crystal-clear 1-sentence synthesis of the document.
2. "overview": A thorough 2-paragraph executive summary of the document.
3. "keyDefinitions": Array of 5 to 8 essential terms from the document, each with {"term", "definition", "memoryTip"}.
4. "formulaBank": Array of governing formulas/rules from the document, each with {"name", "formula", "variables", "whenToUse"}.
5. "blocks": Array of 4 to 6 high-yield revision blocks covering every major section of the document from start to finish, each with:
   - "title": Section title from the document
   - "focus": What to master in this block
   - "coreSummary": Detailed 3-4 sentence conceptual synthesis
   - "keyFormula": Primary equation or rule from this section
   - "keyTakeaways": Array of 3 to 5 detailed bullet takeaways
   - "commonMistakes": Array of 1 to 2 common exam pitfalls from this section
   - "mnemonic": A memory cue or rule of thumb
6. "selfCheck": Array of 4 rapid self-verification questions from the document.`
      },
      {
        role: "user",
        content: `Create a complete, document-grounded revision guide titled '${cleanTitle}' strictly from the document below. Return ONLY a valid JSON object:\n\n${revContext}`
      }
    ],
    response_format: { type: "json_object" },
    maxTokens: 1250
  });

  const rawParsed = safeParseJSON<Record<string, any>>(text(response?.choices?.[0]?.message?.content), {});
  const topicName = source.docName || cleanTitle;

  let oneLineSummary =
    typeof rawParsed.oneLineSummary === "string" && rawParsed.oneLineSummary.length > 10
      ? rawParsed.oneLineSummary
      : `High-yield synthesis of ${topicName}: core principles, governing equations, and essential definitions for rapid mastery.`;

  let overview =
    typeof rawParsed.overview === "string" && rawParsed.overview.length > 25
      ? rawParsed.overview
      : `High-yield comprehensive revision guide for ${topicName}. Structured for rapid recall, mathematical derivations, and concept mastery.`;

  let keyDefinitions = Array.isArray(rawParsed.keyDefinitions)
    ? rawParsed.keyDefinitions.map((d: any) => ({
        term: typeof d.term === "string" ? d.term : (typeof d.name === "string" ? d.name : "Key Term"),
        definition: typeof d.definition === "string" ? d.definition : (typeof d.meaning === "string" ? d.meaning : (typeof d.description === "string" ? d.description : "")),
        memoryTip: typeof d.memoryTip === "string" ? d.memoryTip : (typeof d.tip === "string" ? d.tip : (typeof d.mnemonic === "string" ? d.mnemonic : ""))
      })).filter((d: any) => d.term && d.definition)
    : [];

  let formulaBank = Array.isArray(rawParsed.formulaBank)
    ? rawParsed.formulaBank.map((f: any) => ({
        name: typeof f.name === "string" ? f.name : (typeof f.symbol === "string" ? f.symbol : (typeof f.title === "string" ? f.title : "Governing Formula")),
        formula: typeof f.formula === "string" ? f.formula : (typeof f.equation === "string" ? f.equation : ""),
        variables: typeof f.variables === "string" ? f.variables : (typeof f.description === "string" ? f.description : (typeof f.notes === "string" ? f.notes : "")),
        whenToUse: typeof f.whenToUse === "string" ? f.whenToUse : (typeof f.context === "string" ? f.context : "")
      })).filter((f: any) => f.formula)
    : [];

  let rawBlocks = Array.isArray(rawParsed.blocks) ? rawParsed.blocks : [];
  let blocks = rawBlocks.map((b: any, index: number) => {
    const title = typeof b.title === "string" ? b.title : `Revision Block ${index + 1}`;
    const focus = typeof b.focus === "string" ? b.focus : (typeof b.subtitle === "string" ? b.subtitle : `Master core principles and operational rules`);
    const coreSummary = typeof b.coreSummary === "string" && b.coreSummary.length > 10
      ? b.coreSummary
      : typeof b.content === "string" && b.content.length > 10
        ? b.content
        : typeof b.summary === "string" && b.summary.length > 10
          ? b.summary
          : `High-yield conceptual breakdown and physical mechanics for ${title}.`;
    const keyFormula = typeof b.keyFormula === "string" ? b.keyFormula : (typeof b.formula === "string" ? b.formula : "");
    const rawTakeaways = Array.isArray(b.keyTakeaways) ? b.keyTakeaways : (Array.isArray(b.keyPoints) ? b.keyPoints : (Array.isArray(b.takeaways) ? b.takeaways : []));
    const keyTakeaways = rawTakeaways.map((t: any) => String(t)).filter(Boolean);
    const rawMistakes = Array.isArray(b.commonMistakes) ? b.commonMistakes : (Array.isArray(b.pitfalls) ? b.pitfalls : (Array.isArray(b.mistakes) ? b.mistakes : []));
    const commonMistakes = rawMistakes.map((m: any) => String(m)).filter(Boolean);
    const mnemonic = typeof b.mnemonic === "string" ? b.mnemonic : (typeof b.memoryTip === "string" ? b.memoryTip : "");

    // Also support questions with full solutions if provided
    const rawQuestions = Array.isArray(b.questions) ? b.questions : [];
    const questions = rawQuestions.map((q: any) => {
      if (typeof q === "string") {
        return {
          question: q,
          answer: `Detailed physical derivation and conceptual solution for ${q}: Examine the governing equations, apply boundary conditions, and verify units.`,
          examTrap: ""
        };
      }
      return {
        question: typeof q?.question === "string" ? q.question : String(q || ""),
        answer: typeof q?.answer === "string" && q.answer.length > 5 && !q.answer.includes("Review the section summary")
          ? q.answer
          : typeof q?.solution === "string" && q.solution.length > 5
            ? q.solution
            : `Apply the governing principles and definitions from ${topicName} to solve systematically.`,
        examTrap: typeof q?.examTrap === "string" ? q.examTrap : ""
      };
    });

    return {
      title,
      focus,
      coreSummary,
      keyFormula,
      keyTakeaways,
      commonMistakes,
      mnemonic,
      ...(questions.length > 0 ? { questions } : {})
    };
  });

  if (blocks.length === 0) {
    const parsedFromDoc = parseRealAcademicNotes(source.fullText || "", topicName);
    blocks = parsedFromDoc.map((sec, idx) => ({
      title: sec.heading || `Block ${idx + 1}: ${topicName}`,
      focus: `Master the core principles and mechanisms in ${sec.heading || topicName}`,
      coreSummary: sec.explanation,
      keyFormula: "",
      keyTakeaways: sec.bullets,
      commonMistakes: [`Verify all definitions, boundary conditions, and steps from ${sec.heading || topicName}.`],
      mnemonic: `Connect ${sec.heading || topicName} directly to the worked examples in the document.`
    }));
  }

  let selfCheck = Array.isArray(rawParsed.selfCheck) ? rawParsed.selfCheck.map(String).filter(Boolean) : [];
  if (selfCheck.length === 0) {
    selfCheck = [
      `Can I define the central concepts of ${topicName} without looking?`,
      `Can I state and apply the governing rules and formulas from ${topicName}?`,
      `Can I state the key memory mnemonics and avoid common exam pitfalls in ${topicName}?`,
      `Can I summarize the entire ${topicName} document in my own words from memory?`
    ];
  }

  const content = { oneLineSummary, overview, keyDefinitions, formulaBank, blocks, selfCheck };
  const db = database(await getDb());
  let targetSubjectId = input.subjectId ?? null;
  const docId = source.docId ?? input.documentId ?? null;
  if (!targetSubjectId && docId) {
    try {
      const docRow = await db.select({ subjectId: documents.subjectId }).from(documents).where(eq(documents.id, docId)).limit(1);
      if (docRow[0]?.subjectId) targetSubjectId = docRow[0].subjectId;
    } catch {}
  }
  const inserted = await db.insert(revisionGuides).values({
    userId,
    subjectId: targetSubjectId,
    documentId: docId,
    title: cleanTitle,
    scopeLabel: source.scopeLabel,
    content,
    model: response?.model || "studentgpt-revision-engine"
  });

  const stored = await db
    .select()
    .from(revisionGuides)
    .where(and(eq(revisionGuides.id, Number(inserted[0].insertId)), eq(revisionGuides.userId, userId)))
    .limit(1);
  return stored[0]!;
}

export async function listRevisionGuides(userId: number, subjectId?: number | null) {
  const db = database(await getDb());
  const conditions = [eq(revisionGuides.userId, userId)];
  if (typeof subjectId === "number" && subjectId > 0) {
    conditions.push(eq(revisionGuides.subjectId, subjectId));
  }
  return db
    .select()
    .from(revisionGuides)
    .where(and(...conditions))
    .orderBy(desc(revisionGuides.createdAt));
}

export async function deleteRevisionGuide(userId: number, revisionId: number) {
  const db = database(await getDb());
  await db
    .delete(revisionGuides)
    .where(and(eq(revisionGuides.id, revisionId), eq(revisionGuides.userId, userId)));
  return { success: true } as const;
}

/**
 * Grounded Document Q&A:
 * Answers questions strictly using the uploaded document's contents.
 * Explicitly states when an answer is not found in the document.
 */
export async function askDocumentGrounded(
  userId: number,
  input: { documentId: number; question: string; studyNoteId?: number }
) {
  const db = database(await getDb());

  // Check document access
  let doc = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, input.documentId), eq(documents.userId, userId), eq(documents.status, "ready")))
    .limit(1);
  if (!doc[0]) {
    doc = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, input.documentId), eq(documents.status, "ready")))
      .limit(1);
  }
  if (!doc[0]) throw new Error("Document not found or not ready.");

  const docName = doc[0].originalName;
  const cleanName = docName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");

  // Fetch all chunks in order
  const chunks = await db
    .select({
      id: documentChunks.id,
      chunkIndex: documentChunks.chunkIndex,
      content: documentChunks.content,
      pageStart: documentChunks.pageStart,
      pageEnd: documentChunks.pageEnd
    })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, input.documentId))
    .orderBy(asc(documentChunks.chunkIndex))
    .limit(40);

  let docText = chunks.map(c => c.content).join("\n\n").trim();
  if (!docText) {
    docText = doc[0].extractedText || "";
  }
  docText = docText.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "").trim();

  // Find relevant snippets for citations
  const qWords = input.question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const relevantSnippets: Array<{ chunkIndex: number; preview: string; page?: number | null }> = [];

  for (const c of chunks) {
    const textLower = c.content.toLowerCase();
    const hasMatch = qWords.some(w => textLower.includes(w));
    if (hasMatch) {
      relevantSnippets.push({
        chunkIndex: c.chunkIndex,
        preview: c.content.slice(0, 180).replace(/\s+/g, " ").trim(),
        page: c.pageStart
      });
      if (relevantSnippets.length >= 3) break;
    }
  }

  // If none matched keywords, cite first chunk
  if (relevantSnippets.length === 0 && chunks.length > 0) {
    relevantSnippets.push({
      chunkIndex: chunks[0].chunkIndex,
      preview: chunks[0].content.slice(0, 180).replace(/\s+/g, " ").trim(),
      page: chunks[0].pageStart
    });
  }

  const systemPrompt = `You are an authoritative, strictly grounded academic AI tutor.
The student is asking a question about the uploaded document: "${docName}" (${cleanName}).

STRICT GROUNDING DIRECTIVES:
1. Base your answer EXCLUSIVELY on facts explicitly stated in the document text provided below.
2. Do NOT use outside knowledge, external websites, or generalized assumptions.
3. If the answer cannot be found directly in the document text, reply clearly: "This information is not mentioned in the provided document."
4. Reference the specific section, heading, formula, or part of the document where the information is located.
5. Format your response cleanly using Markdown with bold keywords, bullet points, and code blocks for formulas where appropriate.`;

  const userPrompt = `Document: ${docName}

DOCUMENT TEXT:
${docText.slice(0, 30000)}

STUDENT QUESTION:
${input.question}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    maxTokens: 2500
  });

  const answer = text(response?.choices?.[0]?.message?.content).trim();

  return {
    documentId: input.documentId,
    documentName: docName,
    cleanName,
    question: input.question,
    answer,
    relevantSnippets
  };
}

export async function deleteStudyNote(userId: number, noteId: number) {
  const db = database(await getDb());
  const owned = await db
    .select({ id: studyNotes.id })
    .from(studyNotes)
    .where(and(eq(studyNotes.id, noteId), eq(studyNotes.userId, userId)))
    .limit(1);
  if (!owned[0]) throw new Error("Study note not found.");
  await db.delete(stickyNotes).where(and(eq(stickyNotes.studyNoteId, noteId), eq(stickyNotes.userId, userId)));
  await db.delete(studyNotes).where(and(eq(studyNotes.id, noteId), eq(studyNotes.userId, userId)));
  return { success: true };
}

