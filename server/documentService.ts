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
    try {
      const pdfModule = await import("pdf-parse") as any;
      const PDFParseClass = pdfModule.PDFParse || pdfModule.default;
      if (PDFParseClass) {
        const uint8Data = new Uint8Array(file.buffer);
        const parser = new PDFParseClass({ data: uint8Data });
        const result = await parser.getText();
        await parser.destroy();
        content = result.text?.trim() ?? "";
        pageCount = result.total ?? null;
      }
    } catch (parseErr) {
      console.warn("[PDF Extraction Warning]:", parseErr);
      content = file.buffer.toString("binary").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
    }
    if (!content) content = safeName.replace(/[^a-zA-Z0-9 ]/g, " ");
    const chunks = textChunks(content);
    for (const [chunkIndex, chunk] of Array.from(chunks.entries())) {
      await db.insert(documentChunks).values({ documentId, userId, chunkIndex, content: chunk, tokenCount: Math.ceil(chunk.length / 4), contentHash: crypto.createHash("sha256").update(chunk).digest("hex") });
    }
    await db.update(documents).set({ status: "ready", extractedText: content, pageCount: pageCount ?? 1, processedAt: new Date() }).where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
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

