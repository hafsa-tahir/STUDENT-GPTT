import { describe, expect, it } from "vitest";

describe.skipIf(process.env.RUN_OPENROUTER_LIVE_TESTS !== "1")("OpenRouter credential", () => {
  it("can access the model catalog", async () => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error("OPENROUTER_API_KEY is required for credential validation.");
    }

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { data?: unknown[] };
    expect(Array.isArray(payload.data)).toBe(true);
  }, 20_000);
});
