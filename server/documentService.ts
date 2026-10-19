import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { documentChunks, documentJobs, documents } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGetSignedUrl, storagePut } from "./storage";

const MAX_PDF_BYTES = 12 * 1024 * 1024;

function databaseOrThrow<T>(value: T | null): T { if (!value) throw new Error("The database connection is not available."); return value; }
function textChunks(text: string, size = 1600, overlap = 250) {
  const clean = text.replace(/\s+/g, " ").trim(); const chunks: string[] = [];
  for (let start = 0; start < clean.length; start += size - overlap) { const chunk = clean.slice(start, start + size).trim(); if (chunk.length > 10) chunks.push(chunk); if (start + size >= clean.length) break; }
  if (chunks.length === 0 && clean.length > 0) chunks.push(clean);
  return chunks;
}

export async function uploadPrivatePdf(userId: number, file: { buffer: Buffer; name: string; mimeType: string; subjectId?: number | null }) {
  if (file.mimeType !== "application/pdf") throw new Error("Only PDF files can be uploaded.");
  if (!file.buffer.length || file.buffer.length > MAX_PDF_BYTES) throw new Error("PDF files must be between 1 byte and 12 MB.");
  if (!file.buffer.subarray(0, 4).equals(Buffer.from("%PDF"))) throw new Error("The upload is not a valid PDF file.");
  const db = databaseOrThrow(await getDb());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "study-document.pdf";
  const stored = await storagePut(`private/student-documents/${userId}/${crypto.randomUUID()}-${safeName}`, file.buffer, "application/pdf");
  const inserted = await db.insert(documents).values({ userId, subjectId: file.subjectId ?? null, storageKey: stored.key, originalName: safeName, mimeType: "application/pdf", byteSize: file.buffer.length, status: "processing" });
  const documentId = Number(inserted[0].insertId);
  const job = await db.insert(documentJobs).values({ documentId, userId, jobType: "extract", status: "running", attempts: 1 });
  const jobId = Number(job[0].insertId);
  try {
    let content = "";
    let pageCount: number | null = null;

    // Strategy 1: Modern pdf-parse v2 (PDFParse class)
    try {
      const pdfModule = await import("pdf-parse") as any;
      const PDFParseClass = pdfModule.PDFParse;
      if (typeof PDFParseClass === "function") {
        const parser = new PDFParseClass({ data: new Uint8Array(file.buffer) });
        const result = await parser.getText();
        await parser.destroy();
        if (result && typeof result.text === "string" && result.text.trim().length > 10) {
          content = result.text.trim();
          pageCount = typeof result.total === "number" ? result.total : null;
        }
      }
      
      // Strategy 2: Classic pdf-parse v1 function
      if (!content) {
        const pdfFn = typeof pdfModule === "function" ? pdfModule : pdfModule.default;
        if (typeof pdfFn === "function" && pdfFn !== PDFParseClass) {
          const result = await pdfFn(file.buffer);
          if (result && typeof result.text === "string" && result.text.trim().length > 10) {
            content = result.text.trim();
            pageCount = typeof result.numpages === "number" ? result.numpages : null;
          }
        }
      }
    } catch (parseErr) {
      console.warn("[PDF Parse Engine Notice]:", parseErr);
    }

    // Strategy 3: Uncompressed PDF stream text extractor (/BT ... /ET and Tj operators)
    if (!content) {
      try {
        const raw = file.buffer.toString("latin1");
        const matches: string[] = [];
        const tjRegex = /\(([^)]+)\)\s*Tj/g;
        let match: RegExpExecArray | null;
        while ((match = tjRegex.exec(raw)) !== null) {
          if (match[1] && match[1].trim().length > 1) {
            matches.push(match[1]);
          }
        }
        if (matches.length > 5) {
          content = matches.join(" ").replace(/\s+/g, " ").trim();
        }
      } catch (streamErr) {
        console.warn("[PDF Stream Fallback Warning]:", streamErr);
      }
    }

    // Clean text and remove binary artifacts
    content = (content || "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Strict validation: Reject if content is empty or contains raw binary PDF markers
    const hasRawPdfArtifacts = content.startsWith("%PDF-") || (content.includes("obj <<") && content.includes("endobj"));
    const alphanumericCount = (content.match(/[a-zA-Z0-9]/g) || []).length;

    if (!content || alphanumericCount < 15 || hasRawPdfArtifacts) {
      throw new Error("Could not extract readable text from this document. Please ensure the PDF contains selectable text (not scanned images).");
    }

    const chunks = textChunks(content);
    for (const [chunkIndex, chunk] of Array.from(chunks.entries())) {
      await db.insert(documentChunks).values({
        documentId,
        userId,
        chunkIndex,
        content: chunk,
        tokenCount: Math.ceil(chunk.length / 4),
        contentHash: crypto.createHash("sha256").update(chunk).digest("hex")
      });
    }
    await db.update(documents).set({
      status: "ready",
      extractedText: content,
      pageCount: pageCount ?? 1,
      processedAt: new Date()
    }).where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
    await db.update(documentJobs).set({ status: "complete", completedAt: new Date() }).where(eq(documentJobs.id, jobId));
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 1000) : "Extraction failed.";
    await db.update(documents).set({ status: "failed", failureReason: reason }).where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
    await db.update(documentJobs).set({ status: "failed", errorMessage: reason, completedAt: new Date() }).where(eq(documentJobs.id, jobId));
  }
  const created = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId))).limit(1);
  return created[0]!;
}

export async function listPrivateDocuments(userId: number, subjectId?: number | null) {
  const db = databaseOrThrow(await getDb());
  const conditions = [eq(documents.userId, userId), eq(documents.status, "ready")];
  if (typeof subjectId === "number" && subjectId > 0) {
    conditions.push(eq(documents.subjectId, subjectId));
  }
  return db.select().from(documents).where(and(...conditions)).orderBy(desc(documents.createdAt));
}

export async function updateDocumentSubject(userId: number, documentId: number, subjectId: number | null) {
  const db = databaseOrThrow(await getDb());
  await db.update(documents).set({ subjectId: subjectId && subjectId > 0 ? subjectId : null }).where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
  const updated = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Document not found.");
  return updated[0];
}

export async function deletePrivateDocument(userId: number, documentId: number) {
  const db = databaseOrThrow(await getDb());
  const owned = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId))).limit(1);
  if (!owned[0]) throw new Error("Document not found.");
  await db.delete(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
  return { success: true };
}

export async function getPrivateDocumentDownload(userId: number, documentId: number) {
  const db = databaseOrThrow(await getDb());
  const record = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId), eq(documents.status, "ready"))).limit(1);
  if (!record[0]) throw new Error("Document not found.");
  return storageGetSignedUrl(record[0].storageKey);
}

