import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeLLM } from "./_core/llm";

describe("OpenRouter model fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves through configured models after provider failures", async () => {
    if (!process.env.OPENROUTER_API_KEY) return;

    const requestedModels: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      requestedModels.push(body.model ?? "");

      if (requestedModels.length < 3) {
        return new Response(JSON.stringify({ error: "temporarily unavailable" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          id: "fallback-test",
          created: Date.now(),
          model: body.model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Fallback succeeded." },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const result = await invokeLLM({
      messages: [{ role: "user", content: "Say hello." }],
      maxTokens: 32,
    });

    expect(requestedModels).toHaveLength(3);
    expect(new Set(requestedModels).size).toBe(3);
    expect(result.choices[0]?.message.content).toBe("Fallback succeeded.");
  });
});
