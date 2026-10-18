import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Express } from "express";
import { ENV } from "./env";
import { getStorageSupabase, SUPABASE_STORAGE_BUCKET, getLocalUploadsDir } from "../storage";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // 1. Check Supabase Storage
    const supabase = getStorageSupabase();
    if (supabase) {
      try {
        const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(key);
        if (data?.publicUrl) {
          res.set("Cache-Control", "public, max-age=86400");
          res.redirect(302, data.publicUrl);
          return;
        }
      } catch {
        // Fall through
      }
    }

    // 2. Check local candidate paths (handles both local dev and serverless tmp)
    const candidates = [
      path.join(getLocalUploadsDir(), key),
      path.resolve(process.cwd(), "uploads", key),
      path.join(os.tmpdir(), "studentgpt-uploads", key),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
        return;
      }
    }

    // 3. Check Forge Storage (if configured)
    if (ENV.forgeApiUrl && ENV.forgeApiKey) {
      try {
        const forgeUrl = new URL(
          "v1/storage/presign/get",
          ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
        );
        forgeUrl.searchParams.set("path", key);

        const forgeResp = await fetch(forgeUrl, {
          headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
        });

        if (forgeResp.ok) {
          const { url } = (await forgeResp.json()) as { url: string };
          if (url) {
            res.set("Cache-Control", "no-store");
            res.redirect(307, url);
            return;
          }
        }
      } catch {
        // Fall through
      }
    }

    res.status(404).send("File not found");
  });
}
