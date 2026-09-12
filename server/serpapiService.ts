export type CommunityPerspective = {
  title: string;
  url: string;
  snippet: string;
  source: "Reddit" | "Quora";
};

type SerpOrganicResult = { title?: unknown; link?: unknown; snippet?: unknown };
type SerpPayload = { organic_results?: SerpOrganicResult[]; error?: unknown };

export function isSerpNoResultsError(error: unknown): boolean {
  return typeof error === "string" && /hasn't returned any results|no results/i.test(error);
}

function resultSource(url: string): CommunityPerspective["source"] | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "reddit.com" || host.endsWith(".reddit.com")) return "Reddit";
    if (host === "quora.com" || host.endsWith(".quora.com")) return "Quora";
    return null;
  } catch { return null; }
}

export function normaliseCommunityResults(payload: SerpPayload): CommunityPerspective[] {
  if (!Array.isArray(payload.organic_results)) return [];
  const seen = new Set<string>();
  return payload.organic_results.flatMap((item) => {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const url = typeof item.link === "string" ? item.link.trim() : "";
    const snippet = typeof item.snippet === "string" ? item.snippet.trim() : "";
    const source = resultSource(url);
    if (!title || !url || !source || seen.has(url)) return [];
    seen.add(url);
    return [{ title, url, snippet, source }];
  });
}

async function searchDomain(query: string, domain: "reddit.com" | "quora.com", key: string) {
  const params = new URLSearchParams({ engine: "google", q: `site:${domain} ${query}`, num: "4", api_key: key });
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, { signal: AbortSignal.timeout(14000) });
  if (!response.ok) throw new Error("Community search is temporarily unavailable.");
  const payload = await response.json() as SerpPayload;
  if (isSerpNoResultsError(payload.error)) return [];
  if (typeof payload.error === "string") throw new Error("Community search is temporarily unavailable.");
  return normaliseCommunityResults(payload);
}

export async function searchCommunityPerspectives(query: string): Promise<CommunityPerspective[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("Community search is not configured.");
  const responses = await Promise.allSettled([searchDomain(query, "reddit.com", key), searchDomain(query, "quora.com", key)]);
  const available = responses.flatMap((response) => response.status === "fulfilled" ? response.value : []);
  if (available.length === 0 && responses.some((response) => response.status === "rejected")) {
    throw new Error("Community search is temporarily unavailable.");
  }
  return available.slice(0, 8);
}
