import { describe, expect, it } from "vitest";

describe("FlutLab import configuration", () => {
  it("enables the requested import mode and keeps the app endpoint reachable", async () => {
    expect(process.env.FLUTLAB_IMPORT_CONFIRMED).toBe("true");

    const response = await fetch("http://127.0.0.1:3000/");
    expect(response.status).toBeLessThan(500);
  });
});

