export function resolveApiUrl(req: {
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
}): string {
  let urlStr = req.url || "/api";

  // 1. Check if __path query param was passed (e.g. from Vercel rewrite /api/:match* -> /api/index?__path=:match*)
  if (urlStr.includes("__path=")) {
    try {
      const parsed = new URL(urlStr, "http://localhost");
      const pathParam = parsed.searchParams.get("__path");
      parsed.searchParams.delete("__path");
      const remainingSearch = parsed.search ? parsed.search : "";
      if (pathParam !== null && pathParam !== undefined) {
        const cleanSub = pathParam.startsWith("/") ? pathParam.slice(1) : pathParam;
        return cleanSub ? `/api/${cleanSub}${remainingSearch}` : `/api${remainingSearch}`;
      }
    } catch {
      // Fall through on parse error
    }
  }

  // 2. Check matched path headers from Vercel / Netlify / reverse proxy
  const headers = req.headers || {};
  const rawPath =
    headers["x-matched-path"] ||
    headers["x-vercel-matched-path"] ||
    headers["x-rewrite-url"] ||
    headers["x-original-url"] ||
    headers["x-forwarded-url"];

  if (rawPath && typeof rawPath === "string") {
    let candidate = rawPath;
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      try {
        const u = new URL(candidate);
        candidate = u.pathname + (u.search || "");
      } catch {
        // Fall through
      }
    }

    const pathnameOnly = candidate.split("?")[0];
    if (
      pathnameOnly.startsWith("/api") &&
      pathnameOnly !== "/api/index" &&
      pathnameOnly !== "/api/index.js"
    ) {
      const [pathPart, queryPart] = candidate.split("?");
      const existingQuery = urlStr.includes("?") ? urlStr.split("?")[1] : null;
      const finalQuery = queryPart || existingQuery;
      return finalQuery ? `${pathPart}?${finalQuery}` : pathPart;
    }
  }

  // 3. Fallback: normalize /api/index and /api/index.js to /api
  urlStr = urlStr.replace(/^\/api\/index(\.js)?/, "/api");
  if (urlStr === "" || urlStr.startsWith("?")) {
    urlStr = `/api${urlStr}`;
  }

  return urlStr;
}
