import { describe, expect, it } from "vitest";

describe("YouTube Data API credential", () => {
  it("can retrieve a public video metadata record", async () => {
    const key = process.env.YOUTUBE_DATA_API_KEY;
    expect(key).toBeTruthy();
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${encodeURIComponent(key!)}`);
    expect(response.ok).toBe(true);
    const payload = await response.json() as { items?: unknown[] };
    expect(payload.items?.length).toBeGreaterThan(0);
  }, 20000);
});
