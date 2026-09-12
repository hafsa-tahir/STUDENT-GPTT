type YouTubeSearchResponse = { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; description?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string }; high?: { url?: string } } } }>; error?: { message?: string } };

export type ResearchVideo = { id: string; title: string; channelTitle: string; description: string; publishedAt: string | null; thumbnailUrl: string | null; url: string; relevance: string };

function normalizedTerms(query: string) { return query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(term => term.length > 2).slice(0, 10); }
function relevanceScore(video: { title: string; description: string; channelTitle: string }, terms: string[]) { const text = `${video.title} ${video.description} ${video.channelTitle}`.toLowerCase(); const title = video.title.toLowerCase(); return terms.reduce((score, term) => score + (title.includes(term) ? 5 : 0) + (text.includes(term) ? 2 : 0), 0); }

export async function searchResearchVideos(query: string): Promise<ResearchVideo[]> {
  const key = process.env.YOUTUBE_DATA_API_KEY; if (!key) throw new Error("YouTube research resources are not configured.");
  const focusedQuery = `${query.trim()} explained lecture tutorial`.slice(0, 240); const params = new URLSearchParams({ part: "snippet", type: "video", maxResults: "12", q: focusedQuery, safeSearch: "strict", videoEmbeddable: "true", key });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, { signal: AbortSignal.timeout(10_000) }); const payload = await response.json() as YouTubeSearchResponse;
  if (!response.ok) throw new Error(payload.error?.message || "YouTube resource search failed."); const terms = normalizedTerms(query);
  return (payload.items ?? []).flatMap(item => { const id = item.id?.videoId; const snippet = item.snippet; if (!id || !snippet?.title) return []; const candidate = { id, title: snippet.title, channelTitle: snippet.channelTitle || "YouTube", description: snippet.description || "", publishedAt: snippet.publishedAt || null, thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || null, url: `https://www.youtube.com/watch?v=${id}` }; return [{ ...candidate, relevance: `${terms.filter(term => `${candidate.title} ${candidate.description}`.toLowerCase().includes(term)).slice(0, 3).join(", ") || "topic"} match`, score: relevanceScore(candidate, terms) }]; }).sort((a, b) => b.score - a.score).slice(0, 6).map(({ score: _score, ...video }) => video);
}
