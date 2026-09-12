import { describe, expect, it } from "vitest";
import { invokeLLM } from "./_core/llm";

describe.skipIf(process.env.RUN_OPENROUTER_LIVE_TESTS !== "1")("OpenRouter LLM adapter", () => {
  it("generates a minimal text response through the configured provider", async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is required for OpenRouter adapter validation.");
    }

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Reply with exactly one short sentence." },
        { role: "user", content: "What is photosynthesis?" },
      ],
      maxTokens: 80,
    });

    expect(response.model).toBeTruthy();
    expect(response.choices[0]?.message?.content).toBeTruthy();
  }, 30_000);
});
