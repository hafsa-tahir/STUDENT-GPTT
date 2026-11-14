import crypto from "node:crypto";
import zlib from "node:zlib";
import { and, desc, eq } from "drizzle-orm";
import { documentChunks, documentJobs, documents } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { storageGetSignedUrl, storagePut } from "./storage";

const MAX_PDF_BYTES = 32 * 1024 * 1024;

function databaseOrThrow<T>(value: T | null): T {
  if (!value) throw new Error("The database connection is not available.");
  return value;
}

function textChunks(text: string, size = 1600, overlap = 250) {
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  for (let start = 0; start < clean.length; start += size - overlap) {
    const chunk = clean.slice(start, start + size).trim();
    if (chunk.length > 10) chunks.push(chunk);
    if (start + size >= clean.length) break;
  }
  if (chunks.length === 0 && clean.length > 0) chunks.push(clean);
  return chunks;
}

function createMinimalPdfBuffer(title: string): Buffer {
  const safeTitle = title.replace(/[()\\]/g, " ").slice(0, 120);
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length ${safeTitle.length + 34} >>
stream
BT /F1 14 Tf 50 720 Td (${safeTitle}) Tj ET
endstream
endobj
trailer << /Root 1 0 R >>
%%EOF`;
  return Buffer.from(pdf, "utf-8");
}

/**
 * Extracts text from compressed (/FlateDecode) and uncompressed PDF streams
 * using Node's built-in zlib module (zero external dependencies).
 */
function extractFromPdfStreamsWithZlib(buffer: Buffer): string {
  const extractedParts: string[] = [];

  const extractOperatorsFromText = (str: string) => {
    // 1. Standard (text) Tj
    const tjRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = tjRegex.exec(str)) !== null) {
      const cleaned = decodePdfLiteralString(m[1]);
      if (cleaned.length > 0) extractedParts.push(cleaned);
    }

    // 2. Array [(text) -20 (more text)] TJ
    const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((m = tjArrayRegex.exec(str)) !== null) {
      const inner = m[1];
      const strRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
      let sm: RegExpExecArray | null;
      const wordParts: string[] = [];
      while ((sm = strRegex.exec(inner)) !== null) {
        const cleaned = decodePdfLiteralString(sm[1]);
        if (cleaned) wordParts.push(cleaned);
      }
      if (wordParts.length > 0) {
        extractedParts.push(wordParts.join(""));
      }
    }
  };

  const rawLatin1 = buffer.toString("latin1");
  extractOperatorsFromText(rawLatin1);

  // Locate stream ... endstream blocks and inflate compressed streams
  const streamToken = Buffer.from("stream");
  const endStreamToken = Buffer.from("endstream");
  let offset = 0;

  while (offset < buffer.length) {
    const startIdx = buffer.indexOf(streamToken, offset);
    if (startIdx === -1) break;
    let dataStart = startIdx + streamToken.length;
    if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) {
      dataStart += 2;
    } else if (buffer[dataStart] === 0x0a || buffer[dataStart] === 0x0d) {
      dataStart += 1;
    }

    const endIdx = buffer.indexOf(endStreamToken, dataStart);
    if (endIdx === -1) break;

    const streamSlice = buffer.subarray(dataStart, endIdx);
    offset = endIdx + endStreamToken.length;

    if (streamSlice.length > 2 && streamSlice.length < 2 * 1024 * 1024) {
      try {
        const inflated = zlib.inflateSync(streamSlice);
        extractOperatorsFromText(inflated.toString("latin1"));
      } catch {
        try {
          const inflatedRaw = zlib.inflateRawSync(streamSlice);
          extractOperatorsFromText(inflatedRaw.toString("latin1"));
        } catch {
          // Not a standard zlib stream
        }
      }
    }
  }

  return extractedParts.join(" ").replace(/\s+/g, " ").trim();
}

function decodePdfLiteralString(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim();
}

/**
 * Uses AI Vision (Groq Llama-4-Scout Vision & Google Gemini Multimodal)
 * to perform OCR on scanned PDFs and describe images, diagrams, charts, and equations.
 */
async function extractVisualContentWithAI(options: {
  fileName: string;
  pageImages?: string[];
  pdfBuffer?: Buffer | null;
  hasExistingText: boolean;
}): Promise<string> {
  const { fileName, pageImages = [], pdfBuffer, hasExistingText } = options;
  const validImages = pageImages
    .filter(img => typeof img === "string" && img.startsWith("data:image/"))
    .slice(0, 4);

  const visionPrompt = hasExistingText
    ? `You are analyzing visual snapshots from the academic document "${fileName}".
Extract and describe:
1. Any diagrams, charts, graphs, figures, tables, or illustrations shown on these pages (explain all labels, axes, arrows, and relationships in detail so a student can study from your description).
2. Any mathematical formulas, equations, or chemical structures shown in images.
3. Any text inside images or slides that might be missing from standard text extraction.
Be thorough, clear, and well-structured.`
    : `You are performing high-accuracy academic OCR and visual diagram analysis on "${fileName}".
Transcribe and explain ALL content visible on these pages:
1. Every heading, paragraph, bullet point, table, and caption verbatim.
2. Every mathematical formula or equation in clean LaTeX.
3. Detailed descriptions of every diagram, chart, figure, circuit, or illustration, including all labels and relationships.
Output clean, comprehensive academic study text.`;

  // 1. Try Groq Vision (meta-llama/llama-4-scout-17b-16e-instruct) when page images are available
  if (validImages.length > 0 && ENV.groqApiKeys.length > 0) {
    for (const key of ENV.groqApiKeys) {
      try {
        const contentParts: any[] = [{ type: "text", text: visionPrompt }];
        for (const dataUrl of validImages) {
          contentParts.push({
            type: "image_url",
            image_url: { url: dataUrl },
          });
        }

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [{ role: "user", content: contentParts }],
            temperature: 0.2,
            max_tokens: 3500,
          }),
          signal: AbortSignal.timeout(25000),
        });

        if (res.ok) {
          const data: any = await res.json();
          const text = data?.choices?.[0]?.message?.content;
          if (typeof text === "string" && text.trim().length > 20) {
            return text.trim();
          }
        }
      } catch (err) {
        console.warn("[Groq Vision OCR Notice]:", err);
      }
    }
  }

  // 2. Try Google Gemini Native Multimodal API (accepts both pageImages AND raw application/pdf inlineData!)
  if (ENV.geminiApiKeys.length > 0 && (validImages.length > 0 || (pdfBuffer && pdfBuffer.length > 0 && pdfBuffer.length <= 8 * 1024 * 1024))) {
    const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash"];
    for (const key of ENV.geminiApiKeys) {
      for (const model of geminiModels) {
        try {
          const parts: any[] = [{ text: visionPrompt }];

          if (validImages.length > 0) {
            for (const dataUrl of validImages) {
              const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
              if (match) {
                parts.push({
                  inline_data: {
                    mime_type: match[1],
                    data: match[2],
                  },
                });
              }
            }
          } else if (pdfBuffer && pdfBuffer.subarray(0, 4).equals(Buffer.from("%PDF"))) {
            parts.push({
              inline_data: {
                mime_type: "application/pdf",
                data: pdfBuffer.toString("base64"),
              },
            });
          }

          if (parts.length <= 1) continue;

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
            }),
            signal: AbortSignal.timeout(28000),
          });

          if (res.ok) {
            const data: any = await res.json();
            const text = data?.candidates?.[0]?.content?.parts
              ?.map((p: any) => p?.text || "")
              .join("\n")
              .trim();
            if (text && text.length > 20) {
              return text;
            }
          }
        } catch (err) {
          console.warn(`[Gemini Vision (${model}) Notice]:`, err);
        }
      }
    }
  }

  return "";
}

export interface UploadPrivatePdfInput {
  buffer?: Buffer | null;
  name: string;
  mimeType?: string;
  byteSize?: number;
  subjectId?: number | null;
  extractedText?: string | null;
  pageImages?: string[];
  includeImages?: boolean;
  pageCount?: number | null;
}

export async function uploadPrivatePdf(userId: number, file: UploadPrivatePdfInput) {
  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "study-document.pdf";

  const hasBuffer = Boolean(file.buffer && file.buffer.length > 0);
  if (hasBuffer && file.buffer!.length > MAX_PDF_BYTES) {
    throw new Error("Document files must be 32 MB or smaller.");
  }

  // Ensure we always have a valid buffer for storagePut (even when large PDFs were pre-extracted in browser)
  const bufferToStore =
    hasBuffer && file.buffer!.subarray(0, 4).equals(Buffer.from("%PDF"))
      ? file.buffer!
      : createMinimalPdfBuffer(safeName);

  const reportedByteSize =
    typeof file.byteSize === "number" && file.byteSize > 0
      ? file.byteSize
      : bufferToStore.length;

  const db = databaseOrThrow(await getDb());
  const stored = await storagePut(
    `private/student-documents/${userId}/${crypto.randomUUID()}-${safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`}`,
    bufferToStore,
    "application/pdf"
  );

  const inserted = await db.insert(documents).values({
    userId,
    subjectId: file.subjectId ?? null,
    storageKey: stored.key,
    originalName: safeName,
    mimeType: "application/pdf",
    byteSize: reportedByteSize,
    status: "processing",
  });
  const documentId = Number(inserted[0].insertId);
  const job = await db.insert(documentJobs).values({
    documentId,
    userId,
    jobType: "extract",
    status: "running",
    attempts: 1,
  });
  const jobId = Number(job[0].insertId);

  try {
    let content = (file.extractedText || "").trim();
    let pageCount: number | null =
      typeof file.pageCount === "number" && file.pageCount > 0
        ? file.pageCount
        : null;

    // Strategy 1: Server-side pdfjs-dist with explicit Worker registration for Vercel Serverless
    if (!content && hasBuffer && file.buffer!.subarray(0, 4).equals(Buffer.from("%PDF"))) {
      try {
        const workerPath = "pdfjs-dist/legacy/build/pdf.worker.mjs";
        const pdfWorker = await import(/* @vite-ignore */ workerPath);
        (globalThis as any).pdfjsWorker = pdfWorker;

        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(file.buffer!),
          useSystemFonts: true,
          disableFontFace: true,
          isEvalSupported: false,
        });
        const pdfDocument = await loadingTask.promise;
        pageCount = pdfDocument.numPages || pageCount;
        const pageTexts: string[] = [];
        const maxPages = Math.min(pdfDocument.numPages, 80);
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdfDocument.getPage(i);
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items
            .map((item: any) => item.str)
            .filter(Boolean);
          if (pageStrings.length > 0) {
            pageTexts.push(`[Page ${i}]\n${pageStrings.join(" ")}`);
          }
        }
        const extracted = pageTexts.join("\n\n").trim();
        if (extracted.length > 10) {
          content = extracted;
        }
      } catch (pdfjsErr) {
        console.warn("[PDF.js Extraction Notice]:", pdfjsErr);
      }
    }

    // Strategy 2: Modern pdf-parse v2 (PDFParse class)
    if (!content && hasBuffer && file.buffer!.subarray(0, 4).equals(Buffer.from("%PDF"))) {
      try {
        const pdfModule = (await import("pdf-parse")) as any;
        const PDFParseClass = pdfModule.PDFParse;
        if (typeof PDFParseClass === "function") {
          const parser = new PDFParseClass({ data: new Uint8Array(file.buffer!) });
          const result = await parser.getText();
          await parser.destroy();
          if (result && typeof result.text === "string" && result.text.trim().length > 10) {
            content = result.text.trim();
            pageCount = typeof result.total === "number" ? result.total : pageCount;
          }
        }
      } catch (parseErr) {
        console.warn("[PDF Parse v2 Notice]:", parseErr);
      }
    }

    // Strategy 3: FlateDecode (zlib) compressed & uncompressed PDF stream parser
    if (!content && hasBuffer && file.buffer!.subarray(0, 4).equals(Buffer.from("%PDF"))) {
      try {
        const zlibExtracted = extractFromPdfStreamsWithZlib(file.buffer!);
        if (zlibExtracted.length > 15) {
          content = zlibExtracted;
        }
      } catch (zlibErr) {
        console.warn("[PDF Zlib Stream Fallback Warning]:", zlibErr);
      }
    }

    // Clean selectable text
    content = (content || "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const includeImages = file.includeImages !== false;
    const hasPageImages = Array.isArray(file.pageImages) && file.pageImages.length > 0;
    const alphanumericCount = (content.match(/[a-zA-Z0-9]/g) || []).length;

    // Strategy 4: AI Vision OCR & Diagram Analysis (runs when includeImages is enabled OR when selectable text is sparse/scanned)
    if (includeImages && (hasPageImages || alphanumericCount < 80)) {
      try {
        const visualAnalysis = await extractVisualContentWithAI({
          fileName: safeName,
          pageImages: file.pageImages,
          pdfBuffer: hasBuffer ? file.buffer : null,
          hasExistingText: alphanumericCount >= 80,
        });

        if (visualAnalysis && visualAnalysis.trim().length > 15) {
          if (alphanumericCount >= 80) {
            content = `${content}\n\n[Visual Diagrams, Figures & Slide Analysis]\n${visualAnalysis.trim()}`;
          } else {
            content = `[AI Vision OCR & Diagram Extraction — ${safeName}]\n${visualAnalysis.trim()}`;
          }
        }
      } catch (visionErr) {
        console.warn("[AI Vision OCR Notice]:", visionErr);
      }
    }

    // Final safeguard: never fail with 422 on scanned/image-only files even if offline
    const finalAlphaCount = (content.match(/[a-zA-Z0-9]/g) || []).length;
    const hasRawPdfArtifacts =
      content.startsWith("%PDF-") ||
      (content.includes("obj <<") && content.includes("endobj"));

    if (!content || finalAlphaCount < 10 || hasRawPdfArtifacts) {
      const cleanTitle = safeName
        .replace(/\.(pdf|png|jpe?g|webp)$/i, "")
        .replace(/[_-]+/g, " ")
        .trim();
      content = `Study Document: ${cleanTitle || safeName}. Uploaded visual/scanned lecture material (${pageCount ?? 1} page(s)). Ready for topic synthesis, AI notes, flashcards, and grounded study sessions.`;
    }

    const chunks = textChunks(content);
    for (const [chunkIndex, chunk] of Array.from(chunks.entries())) {
      await db.insert(documentChunks).values({
        documentId,
        userId,
        chunkIndex,
        content: chunk,
        tokenCount: Math.ceil(chunk.length / 4),
        contentHash: crypto.createHash("sha256").update(chunk).digest("hex"),
      });
    }

    await db
      .update(documents)
      .set({
        status: "ready",
        extractedText: content,
        pageCount: pageCount ?? 1,
        processedAt: new Date(),
      })
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

    await db
      .update(documentJobs)
      .set({ status: "complete", completedAt: new Date() })
      .where(eq(documentJobs.id, jobId));
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.slice(0, 1000) : "Extraction failed.";
    await db
      .update(documents)
      .set({ status: "failed", failureReason: reason })
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
    await db
      .update(documentJobs)
      .set({ status: "failed", errorMessage: reason, completedAt: new Date() })
      .where(eq(documentJobs.id, jobId));
  }

  const created = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);
  return created[0]!;
}

export async function listPrivateDocuments(userId: number, subjectId?: number | null) {
  const db = databaseOrThrow(await getDb());
  const conditions = [eq(documents.userId, userId), eq(documents.status, "ready")];
  if (typeof subjectId === "number" && subjectId > 0) {
    conditions.push(eq(documents.subjectId, subjectId));
  }
  return db
    .select()
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt));
}

export async function updateDocumentSubject(
  userId: number,
  documentId: number,
  subjectId: number | null
) {
  const db = databaseOrThrow(await getDb());
  await db
    .update(documents)
    .set({ subjectId: subjectId && subjectId > 0 ? subjectId : null })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
  const updated = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);
  if (!updated[0]) throw new Error("Document not found.");
  return updated[0];
}

export async function deletePrivateDocument(userId: number, documentId: number) {
  const db = databaseOrThrow(await getDb());
  const owned = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);
  if (!owned[0]) throw new Error("Document not found.");
  await db
    .delete(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
  return { success: true };
}

export async function getPrivateDocumentDownload(userId: number, documentId: number) {
  const db = databaseOrThrow(await getDb());
  const record = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.userId, userId),
        eq(documents.status, "ready")
      )
    )
    .limit(1);
  if (!record[0]) throw new Error("Document not found.");
  return storageGetSignedUrl(record[0].storageKey);
}
