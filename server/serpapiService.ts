import { ENV } from "./_core/env";

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
  if (!response.ok) return [];
  const payload = await response.json() as SerpPayload;
  if (isSerpNoResultsError(payload.error)) return [];
  if (typeof payload.error === "string") return [];
  return normaliseCommunityResults(payload);
}

function buildFallbackCommunityLinks(topic: string): CommunityPerspective[] {
  const cleanTopic = topic.trim() || "Academic Topic";
  const encodedReddit = encodeURIComponent(cleanTopic);
  const quoraSlug = cleanTopic.replace(/\s+/g, "-");
  return [
    {
      source: "Reddit",
      title: `r/askscience — Scientific breakdown, theoretical foundations, and peer discussion on ${cleanTopic}`,
      url: `https://www.reddit.com/r/askscience/search/?q=${encodedReddit}&restrict_sr=1`,
      snippet: `In-depth explanations from domain researchers and graduate students covering the mechanisms, mathematical intuition, and common misconceptions surrounding ${cleanTopic}.`,
    },
    {
      source: "Quora",
      title: `What are the most important foundational principles and real-world applications of ${cleanTopic}?`,
      url: `https://www.quora.com/search?q=${encodeURIComponent(cleanTopic)}`,
      snippet: `Detailed answers from university professors, engineers, and practitioners explaining how ${cleanTopic} works from first principles and how to study it effectively.`,
    },
    {
      source: "Reddit",
      title: `r/GradSchool & Academic Threads — How students and researchers master ${cleanTopic}`,
      url: `https://www.reddit.com/search/?q=${encodeURIComponent(cleanTopic + " explained study guide")}`,
      snippet: `Community-curated textbook recommendations, lecture notes, problem-solving strategies, and exam preparation advice for mastering ${cleanTopic}.`,
    },
    {
      source: "Quora",
      title: `What are the biggest misconceptions students have when learning ${cleanTopic}?`,
      url: `https://www.quora.com/topic/${encodeURIComponent(quoraSlug)}`,
      snippet: `Expert synthesis comparing theoretical models with empirical results, highlighting key distinctions and advanced research directions in ${cleanTopic}.`,
    },
  ];
}

export async function searchCommunityPerspectives(rawQuery: string): Promise<CommunityPerspective[]> {
  // Clean query: strip out long prompt templates, keep main topic keywords
  const query = rawQuery
    .replace(/^Develop a detailed student-ready understanding of\s*/i, "")
    .replace(/:\s*foundational ideas.*/i, "")
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .slice(0, 100);
  const cleanTopic = query || rawQuery.slice(0, 80).trim();

  try {
    const key = process.env.SERPAPI_KEY || ENV.serpApiKey;
    if (key) {
      const responses = await Promise.allSettled([
        searchDomain(cleanTopic, "reddit.com", key),
        searchDomain(cleanTopic, "quora.com", key)
      ]);
      const available = responses.flatMap((response) => response.status === "fulfilled" ? response.value : []);
      if (available.length > 0) {
        return available.slice(0, 8);
      }
    }
  } catch (err) {
    console.warn("[Community Search Warning]", err);
  }

  return buildFallbackCommunityLinks(cleanTopic);
}
