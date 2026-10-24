import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

export const SUPABASE_STORAGE_BUCKET = "studentgpt-storage";
const DEFAULT_SUPABASE_URL = "REDACTED";
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "REDACTED";

let supabaseStorageClient: ReturnType<typeof createClient> | null = null;
export function getStorageSupabase() {
  if (!supabaseStorageClient) {
    const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceRoleKey) {
      supabaseStorageClient = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }
  return supabaseStorageClient;
}

export function getLocalUploadsDir(): string {
  // If running in AWS Lambda / Netlify / Vercel serverless, process.cwd() (/var/task) is read-only.
  // In serverless, os.tmpdir() is the only writable directory.
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NETLIFY ||
    (typeof process.cwd === "function" && process.cwd().startsWith("/var/task"))
  );
  if (isServerless) {
    return path.join(os.tmpdir(), "studentgpt-uploads");
  }
  return path.resolve(process.cwd(), "uploads");
}

function ensureUploadsDir(): string {
  const dir = getLocalUploadsDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch {
    // If mkdir in current directory failed (e.g. read-only filesystem), fall back to os.tmpdir()
    const tmpDir = path.join(os.tmpdir(), "studentgpt-uploads");
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    } catch {
      // ignore
    }
    return tmpDir;
  }
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);

  // 1. Primary Cloud Storage: Supabase Storage (Works seamlessly across Netlify, Render, and Local)
  const supabase = getStorageSupabase();
  if (supabase) {
    try {
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(key, buffer, {
          contentType,
          upsert: true,
        });

      if (!uploadErr && uploadData) {
        const { data: urlData } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(key);
        return { key, url: urlData?.publicUrl || `/manus-storage/${key}` };
      }
      console.warn("[Supabase Storage Upload Warning]:", uploadErr?.message);
    } catch (err) {
      console.warn("[Supabase Storage Upload Error]:", err);
    }
  }

  // 2. Secondary Cloud Storage: Forge API (if configured)
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (forgeUrl && forgeKey) {
    try {
      const presignUrl = new URL("v1/storage/presign/put", forgeUrl.replace(/\/+$/, "") + "/");
      presignUrl.searchParams.set("path", key);
      const presignResp = await fetch(presignUrl, {
        headers: { Authorization: `Bearer ${forgeKey}` },
      });
      if (presignResp.ok) {
        const { url: s3Url } = (await presignResp.json()) as { url: string };
        if (s3Url) {
          const uploadResp = await fetch(s3Url, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: buffer,
          });
          if (uploadResp.ok) {
            return { key, url: `/manus-storage/${key}` };
          }
        }
      }
    } catch (err) {
      console.warn("[Forge Storage Upload Error]:", err);
    }
  }

  // 3. Local/tmp storage fallback (safe for serverless read-only environments)
  const baseDir = ensureUploadsDir();
  const filePath = path.join(baseDir, key);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
  } catch (fsErr) {
    console.warn("[Local Storage Write Error]:", fsErr);
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const supabase = getStorageSupabase();
  if (supabase) {
    try {
      const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(key);
      if (data?.publicUrl) return { key, url: data.publicUrl };
    } catch {
      // Fall through
    }
  }
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);

  // 1. Supabase Storage Public / Signed URL
  const supabase = getStorageSupabase();
  if (supabase) {
    try {
      const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(key);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    } catch {
      // Fall through
    }
  }

  // 2. Forge presigned URL
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (forgeUrl && forgeKey) {
    try {
      const getUrl = new URL("v1/storage/presign/get", forgeUrl.replace(/\/+$/, "") + "/");
      getUrl.searchParams.set("path", key);
      const resp = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${forgeKey}` },
      });
      if (resp.ok) {
        const { url } = (await resp.json()) as { url: string };
        if (url) return url;
      }
    } catch {
      // Fall through
    }
  }

  return `/manus-storage/${key}`;
}
