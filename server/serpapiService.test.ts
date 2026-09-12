import { describe, expect, it } from "vitest";
import { isSerpNoResultsError, normaliseCommunityResults } from "./serpapiService";

describe("community search result normalization", () => {
  it("keeps only unique Reddit and Quora result cards with clear source labels", () => {
    const results = normaliseCommunityResults({ organic_results: [
      { title: "A Reddit thread", link: "https://www.reddit.com/r/study/comments/example", snippet: "A useful community point." },
      { title: "Duplicate", link: "https://www.reddit.com/r/study/comments/example", snippet: "Duplicate." },
      { title: "A Quora answer", link: "https://www.quora.com/How-do-students-study", snippet: "Another public view." },
      { title: "Unrelated result", link: "https://example.com/article", snippet: "Ignore this." },
    ] });
    expect(results).toEqual([
      { title: "A Reddit thread", url: "https://www.reddit.com/r/study/comments/example", snippet: "A useful community point.", source: "Reddit" },
      { title: "A Quora answer", url: "https://www.quora.com/How-do-students-study", snippet: "Another public view.", source: "Quora" },
    ]);
  });
});

describe("SerpAPI error classification", () => {
  it("treats a provider no-results message as an empty result condition", () => {
    expect(isSerpNoResultsError("Google hasn't returned any results for this query.")).toBe(true);
    expect(isSerpNoResultsError("No results found")).toBe(true);
    expect(isSerpNoResultsError("Invalid API key")).toBe(false);
  });
});
