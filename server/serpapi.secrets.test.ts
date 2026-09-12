import { describe, expect, it } from "vitest";

describe("SerpAPI credential", () => {
  it("can retrieve a lightweight public result set", async () => {
    const key = process.env.SERPAPI_KEY;
    expect(key).toBeTruthy();
    const response = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(key!)}`, { signal: AbortSignal.timeout(12000) });
    expect(response.ok).toBe(true);
    const payload = await response.json() as { plan_name?: string; total_searches_left?: number };
    expect(typeof payload.plan_name).toBe("string");
    expect(typeof payload.total_searches_left).toBe("number");
  }, 20000);
});
