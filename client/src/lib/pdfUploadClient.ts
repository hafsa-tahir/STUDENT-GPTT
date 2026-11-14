import { getSupabaseAccessToken } from "./supabase";

const VISION_SETTING_KEY = "studentgpt_pdf_vision_enabled";

export function getPdfVisionSetting(): boolean {
  if (typeof window === "undefined") return true;
  const saved = window.localStorage.getItem(VISION_SETTING_KEY);
  if (saved === null) return true; // Enabled by default
  return saved === "true";
}

export function setPdfVisionSetting(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VISION_SETTING_KEY, enabled ? "true" : "false");
}

export function isSupportedDocumentFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  return (
    mime === "application/pdf" ||
    name.endsWith(".pdf") ||
    mime.startsWith("image/") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp")
  );
}

/**
 * Converts an image File into a compressed JPEG data URL using HTML5 Canvas.
 */
async function imageFileToDataUrl(file: File, maxDim = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts selectable text AND renders key page snapshots (for scanned PDFs & PDFs with images/diagrams)
 * directly in the browser using pdfjs-dist + HTML5 Canvas.
 */
export async function extractPdfInBrowser(
  file: File,
  includeImages: boolean
): Promise<{
  extractedText: string;
  pageImages: string[];
  pageCount: number;
}> {
  const isImage =
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|webp)$/i.test(file.name);

  if (isImage) {
    try {
      const dataUrl = await imageFileToDataUrl(file, 1400);
      return {
        extractedText: "",
        pageImages: [dataUrl],
        pageCount: 1,
      };
    } catch {
      return { extractedText: "", pageImages: [], pageCount: 1 };
    }
  }

  try {
    const pdfjsLib: any = await import("pdfjs-dist");
    // Configure worker using CDN or inline fallback so it works in Vite & Android WebView
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "5.4.296"}/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await file.arrayBuffer();
    let pdfDocument: any;
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        useSystemFonts: true,
        isEvalSupported: false,
      });
      pdfDocument = await loadingTask.promise;
    } catch {
      // Fallback: disable worker if CDN worker is blocked
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "";
      }
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false,
      });
      pdfDocument = await loadingTask.promise;
    }

    const numPages: number = pdfDocument.numPages || 1;
    const pageTexts: string[] = [];
    const pageImages: string[] = [];

    // Extract text from up to 60 pages
    const maxTextPages = Math.min(numPages, 60);
    // Render up to 4 pages as images when includeImages is true or when pages have little text (scanned/diagrams)
    const maxImagePages = includeImages ? Math.min(numPages, 4) : 0;

    for (let i = 1; i <= maxTextPages; i++) {
      try {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const strings = (textContent.items || [])
          .map((item: any) => (typeof item.str === "string" ? item.str : ""))
          .filter(Boolean);
        const pageText = strings.join(" ").replace(/\s+/g, " ").trim();
        if (pageText.length > 0) {
          pageTexts.push(`[Page ${i}]\n${pageText}`);
        }

        // Render page to canvas if Vision/Image mode is enabled (or if page is scanned with < 40 chars)
        const shouldRenderPage =
          pageImages.length < 4 &&
          (i <= maxImagePages || pageText.length < 40);

        if (shouldRenderPage && typeof document !== "undefined") {
          try {
            const baseViewport = page.getViewport({ scale: 1 });
            const targetScale = Math.min(
              1.5,
              1100 / Math.max(baseViewport.width || 600, baseViewport.height || 800)
            );
            const viewport = page.getViewport({ scale: Math.max(0.75, targetScale) });
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#FFFFFF";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              await page.render({ canvasContext: ctx, viewport }).promise;
              const jpegUrl = canvas.toDataURL("image/jpeg", 0.72);
              if (jpegUrl && jpegUrl.startsWith("data:image/")) {
                pageImages.push(jpegUrl);
              }
            }
          } catch {
            // Ignore canvas render failure on individual page
          }
        }
      } catch {
        // Ignore individual page error
      }
    }

    return {
      extractedText: pageTexts.join("\n\n").trim(),
      pageImages,
      pageCount: numPages,
    };
  } catch (err) {
    console.warn("[Browser PDF Pre-Extraction Notice]:", err);
    return {
      extractedText: "",
      pageImages: [],
      pageCount: 1,
    };
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export interface UploadDocumentOptions {
  file: File;
  subjectId?: number | null;
  includeImages?: boolean;
  onStatus?: (stage: string) => void;
}

export interface UploadedDocumentRecord {
  id: number;
  status: string;
  originalName: string;
  subjectId?: number | null;
  failureReason?: string | null;
  pageCount?: number | null;
}

/**
 * Uploads a PDF (with or without images/scanned pages) or an Image file to /api/documents/upload.
 * Automatically performs browser-side text + page snapshot extraction so scanned PDFs,
 * diagram-heavy lecture slides, and large PDFs (> 4.5 MB) always succeed on Vercel Serverless.
 */
export async function uploadStudyDocument({
  file,
  subjectId,
  includeImages = getPdfVisionSetting(),
  onStatus,
}: UploadDocumentOptions): Promise<UploadedDocumentRecord> {
  if (!isSupportedDocumentFile(file)) {
    throw new Error("Please select a PDF file (.pdf) or lecture image (.png, .jpg, .webp).");
  }

  if (file.size > 30 * 1024 * 1024) {
    throw new Error("Files must be 30 MB or smaller.");
  }

  const token = getSupabaseAccessToken();
  if (!token) {
    throw new Error("Your session is not active. Please sign in again.");
  }

  onStatus?.(
    includeImages
      ? "Scanning text, images & diagrams…"
      : "Extracting document text…"
  );

  const { extractedText, pageImages, pageCount } = await extractPdfInBrowser(
    file,
    includeImages
  );

  // Include raw binary as base64 if file is <= 2.4 MB so total JSON payload stays well below Vercel's 4.5 MB limit
  let fileBase64: string | undefined;
  if (file.size <= 2.4 * 1024 * 1024) {
    try {
      const ab = await file.arrayBuffer();
      fileBase64 = arrayBufferToBase64(ab);
    } catch {
      fileBase64 = undefined;
    }
  }

  onStatus?.(
    includeImages && pageImages.length > 0
      ? "Analyzing PDF visuals & indexing…"
      : "Uploading & indexing document…"
  );

  const response = await fetch("/api/documents/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-File-Name": encodeURIComponent(file.name),
      ...(subjectId && subjectId > 0 ? { "X-Subject-Id": String(subjectId) } : {}),
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      byteSize: file.size,
      subjectId: subjectId && subjectId > 0 ? subjectId : null,
      includeImages,
      extractedText,
      pageImages: includeImages ? pageImages.slice(0, 4) : pageImages.slice(0, 2),
      pageCount,
      fileBase64,
    }),
  });

  let body: {
    error?: string;
    document?: UploadedDocumentRecord;
  } = {};

  try {
    const text = await response.text();
    body = JSON.parse(text);
  } catch {
    if (response.status === 413) {
      throw new Error("File payload was too large. Try disabling high-res image snapshots or using a smaller file.");
    }
    if (!response.ok) {
      throw new Error(`Upload error (${response.status}: ${response.statusText || "Request failed"}).`);
    }
  }

  if (!response.ok || body.error || !body.document || body.document.status === "failed") {
    throw new Error(
      body.error ||
        body.document?.failureReason ||
        "Upload failed: unable to process document."
    );
  }

  return body.document;
}

