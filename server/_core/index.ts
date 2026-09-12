import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { authenticateSupabaseRequest } from "./context";
import { getPrivateDocumentDownload, uploadPrivatePdf } from "../documentService";
import { getResearchExportFile } from "../researchService";
import { streamLLM } from "./llm";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.post("/api/documents/upload", express.raw({ type: "application/pdf", limit: "12mb" }), async (req, res) => {
    try {
      const user = await authenticateSupabaseRequest(req);
      if (!user) return res.status(401).json({ error: "Authentication is required." });
      if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: "PDF content is required." });
      const originalName = typeof req.headers["x-file-name"] === "string" ? decodeURIComponent(req.headers["x-file-name"]) : "study-document.pdf";
      const subjectId = typeof req.headers["x-subject-id"] === "string" && req.headers["x-subject-id"] ? Number(req.headers["x-subject-id"]) : null;
      const document = await uploadPrivatePdf(user.id, { buffer: req.body, name: originalName, mimeType: "application/pdf", subjectId: Number.isInteger(subjectId) && subjectId! > 0 ? subjectId : null });
      return res.status(201).json({ document });
    } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Upload failed." }); }
  });
  app.get("/api/documents/:documentId/download", async (req, res) => {
    try {
      const user = await authenticateSupabaseRequest(req);
      if (!user) return res.status(401).json({ error: "Authentication is required." });
      const id = Number(req.params.documentId);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid document." });
      const signedUrl = await getPrivateDocumentDownload(user.id, id);
      return res.redirect(302, signedUrl);
    } catch { return res.status(404).json({ error: "Document not found." }); }
  });
  app.get("/api/research-exports/:exportId/download", async (req, res) => {
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
  app.post("/api/chat/stream", async (req, res) => {
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
  app.get("/api/auth/supabase-config", (_req, res) => {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return res.status(503).json({ error: "Authentication is not configured." });
    }
    return res.json({ url, anonKey });
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
