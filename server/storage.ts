import fs from "node:fs";
import path from "node:path";
import { ENV } from "./_core/env";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  const key = appendHashSuffix(normalizeKey(relKey));

  if (forgeUrl && forgeKey) {
    const presignUrl = new URL("v1/storage/presign/put", forgeUrl.replace(/\/+$/, "") + "/");
    presignUrl.searchParams.set("path", key);
    const presignResp = await fetch(presignUrl, {
      headers: { Authorization: `Bearer ${forgeKey}` },
    });
    if (presignResp.ok) {
      const { url: s3Url } = (await presignResp.json()) as { url: string };
      if (s3Url) {
        const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
        const uploadResp = await fetch(s3Url, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob,
        });
        if (uploadResp.ok) {
          return { key, url: `/manus-storage/${key}` };
        }
      }
    }
  }

  // Local storage fallback
  ensureUploadsDir();
  const filePath = path.join(UPLOADS_DIR, key);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  fs.writeFileSync(filePath, buffer);

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  const key = normalizeKey(relKey);

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
      // Fallthrough to local url
    }
  }

  return `/manus-storage/${key}`;
}

