import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext, authenticateSupabaseRequest } from "./_core/context";
import { getPrivateDocumentDownload, uploadPrivatePdf } from "./documentService";
import { getResearchExportFile } from "./researchService";
import { streamLLM } from "./_core/llm";
import { resolveApiUrl } from "./_core/urlResolver";

export function createExpressApp() {
  const app = express();
  app.set("trust proxy", true);
  
  // CORS & Preflight handling
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-file-name, x-subject-id, trpc-accept");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // Normalize Netlify / Vercel serverless function path prefixes
  app.use((req, _res, next) => {
    req.url = resolveApiUrl(req);
    if (req.url.startsWith("/.netlify/functions/api")) {
      req.url = req.url.replace("/.netlify/functions/api", "/api");
    }
    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.post(["/api/documents/upload", "/documents/upload"], express.raw({ type: ["application/pdf", "application/octet-stream", "image/*"], limit: "25mb" }), async (req, res) => {
    try {
      const user = await authenticateSupabaseRequest(req);
      if (!user) return res.status(401).json({ error: "Authentication is required." });

      // Case 1: JSON payload with pre-extracted text, rendered page images (Vision OCR), and optional base64 binary
      if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
        const body = req.body as {
          fileName?: string;
          mimeType?: string;
          byteSize?: number;
          subjectId?: number | null;
          includeImages?: boolean;
          extractedText?: string;
          pageImages?: string[];
          pageCount?: number;
          fileBase64?: string;
        };

        const headerName = typeof req.headers["x-file-name"] === "string" ? decodeURIComponent(req.headers["x-file-name"]) : "";
        const originalName = (body.fileName || headerName || "study-document.pdf").trim();
        const headerSubject = typeof req.headers["x-subject-id"] === "string" && req.headers["x-subject-id"] ? Number(req.headers["x-subject-id"]) : null;
        const subjectId = typeof body.subjectId === "number" && body.subjectId > 0
          ? body.subjectId
          : Number.isInteger(headerSubject) && headerSubject! > 0
          ? headerSubject
          : null;

        const pdfBuffer = typeof body.fileBase64 === "string" && body.fileBase64.length > 0
          ? Buffer.from(body.fileBase64, "base64")
          : null;

        const document = await uploadPrivatePdf(user.id, {
          buffer: pdfBuffer,
          name: originalName,
          mimeType: body.mimeType || "application/pdf",
          byteSize: body.byteSize,
          subjectId,
          extractedText: body.extractedText || "",
          pageImages: Array.isArray(body.pageImages) ? body.pageImages : [],
          includeImages: body.includeImages !== false,
          pageCount: body.pageCount ?? null,
        });

        if (document.status === "failed") {
          return res.status(422).json({ error: document.failureReason || "Text extraction failed.", document });
        }
        return res.status(201).json({ document });
      }

      // Case 2: Raw binary upload fallback
      let pdfBuffer: Buffer | null = null;
      if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        pdfBuffer = req.body;
      } else if (typeof req.body === "string" && req.body.length > 0) {
        const isBase64 = (req as any).isBase64Encoded || /^[A-Za-z0-9+/=]+\s*$/.test(req.body.slice(0, 100));
        pdfBuffer = Buffer.from(req.body, isBase64 ? "base64" : "binary");
      }

      if (!pdfBuffer || !pdfBuffer.length) {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          if (chunks.length > 0) {
            pdfBuffer = Buffer.concat(chunks);
          }
        } catch {
          // ignore stream error
        }
      }

      if (!pdfBuffer || !pdfBuffer.length) return res.status(400).json({ error: "Document content is required." });
      const originalName = typeof req.headers["x-file-name"] === "string" ? decodeURIComponent(req.headers["x-file-name"]) : "study-document.pdf";
      const subjectId = typeof req.headers["x-subject-id"] === "string" && req.headers["x-subject-id"] ? Number(req.headers["x-subject-id"]) : null;
      const document = await uploadPrivatePdf(user.id, {
        buffer: pdfBuffer,
        name: originalName,
        mimeType: "application/pdf",
        subjectId: Number.isInteger(subjectId) && subjectId! > 0 ? subjectId : null,
        includeImages: true,
      });
      if (document.status === "failed") {
        return res.status(422).json({ error: document.failureReason || "Text extraction failed.", document });
      }
      return res.status(201).json({ document });
    } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Upload failed." }); }
  });

  app.get(["/api/documents/:documentId/download", "/documents/:documentId/download"], async (req, res) => {
    try {
      const user = await authenticateSupabaseRequest(req);
      if (!user) return res.status(401).json({ error: "Authentication is required." });
      const id = Number(req.params.documentId);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid document." });
      const signedUrl = await getPrivateDocumentDownload(user.id, id);
      return res.redirect(302, signedUrl);
    } catch { return res.status(404).json({ error: "Document not found." }); }
  });

  app.get(["/api/research-exports/:exportId/download", "/research-exports/:exportId/download"], async (req, res) => {
    try {
      const user = await authenticateSupabaseRequest(req);
      if (!user) return res.status(401).json({ error: "Authentication is required." });
      const id = Number(req.params.exportId);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid research export." });
      const file = await getResearchExportFile(user.id, id);
      const safeFileName = file.fileName.replace(/[\r\n"]/g, "_");
      res.status(200).set({ "Content-Type": file.mimeType, "Content-Length": String(file.bytes.byteLength), "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`, "Cache-Control": "private, no-store" });
      return res.send(file.bytes);
    } catch { return res.status(404).json({ error: "Research export not found." }); }
  });

  app.get(["/api/tts", "/tts"], async (req, res) => {
    try {
      const rawText = typeof req.query.text === "string" ? req.query.text.trim() : "";
      if (!rawText) return res.status(400).json({ error: "Text is required." });
      const text = rawText.slice(0, 200);

      const ttsUrls = [
        `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(text)}`,
        `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(text)}`,
        `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`,
      ];

      for (const url of ttsUrls) {
        try {
          const upstream = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
            signal: AbortSignal.timeout(10000),
          });
          if (upstream.ok) {
            const arrayBuf = await upstream.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            if (buffer.length > 100) {
              res.status(200).set({
                "Content-Type": "audio/mpeg",
                "Content-Length": String(buffer.length),
                "Cache-Control": "public, max-age=86400",
              });
              return res.send(buffer);
            }
          }
        } catch {
          // try next TTS provider
        }
      }

      return res.status(502).json({ error: "TTS audio stream unavailable." });
    } catch {
      return res.status(500).json({ error: "TTS failed." });
    }
  });

  app.post(["/api/chat/stream", "/chat/stream"], async (req, res) => {
    try {
      const user = await authenticateSupabaseRequest(req);
      if (!user) return res.status(401).json({ error: "Authentication is required." });
      const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
      if (!content || content.length > 12000) return res.status(400).json({ error: "A valid study question is required." });
      const upstream = await streamLLM({ messages: [{ role: "system", content: "You are StudentGPT, a careful academic assistant. Use concise Markdown and acknowledge uncertainty rather than inventing claims." }, { role: "user", content }] });
      if (!upstream.body) throw new Error("The AI provider did not return a response stream.");
      res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
      const reader = upstream.body.getReader(); const decoder = new TextDecoder(); let cancelled = false;
      res.on("close", () => { cancelled = true; reader.cancel().catch(() => undefined); });
      while (!cancelled) { const { done, value } = await reader.read(); if (done) break; res.write(decoder.decode(value, { stream: true })); }
      res.end();
    } catch (error) { if (!res.headersSent) res.status(500).json({ error: error instanceof Error ? error.message : "Stream unavailable." }); else res.end(); }
  });

  const DEFAULT_SUPABASE_URL = "";
  const DEFAULT_SUPABASE_ANON_KEY = "";

  app.get(["/health", "/api", "/api/health"], (_req, res) => {
    res.json({ status: "ok", service: "StudentGPT API", timestamp: new Date().toISOString() });
  });

  app.get(["/api/auth/supabase-config", "/auth/supabase-config"], (_req, res) => {
    const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return res.status(503).json({ error: "Authentication is not configured." });
    }
    return res.json({ url, anonKey });
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // tRPC API middleware mounted on all route variations
  const trpcHandler = createExpressMiddleware({
    router: appRouter,
    createContext,
  });

  app.use("/.netlify/functions/api/trpc", trpcHandler);
  app.use("/.netlify/functions/api/api/trpc", trpcHandler);
  app.use("/api/trpc", trpcHandler);
  app.use("/trpc", trpcHandler);

  // Catch-all JSON fallback for any unhandled API requests
  app.use(["/api", "/trpc", "/.netlify"], (req, res) => {
    res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl || req.url}` } });
  });

  // Global Express error handler returning JSON instead of HTML
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[Express Error]", err);
    res.status(err?.status || 500).json({ error: { message: err?.message || "Internal server error." } });
  });

  return app;
}
