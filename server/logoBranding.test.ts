import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const selectedLogo = "/manus-storage/studentgpt-logo-option-1_b720cde2.png";
const projectFile = (...parts: string[]) => readFileSync(resolve(process.cwd(), ...parts), "utf8");

describe("selected StudentGPT logo branding", () => {
  it("uses the selected open-book mark in desktop shell, mobile Home mark, sign-in header, and favicon", () => {
    const shell = projectFile("client", "src", "components", "StudentAppShell.tsx");
    const login = projectFile("client", "src", "pages", "Login.tsx");
    const documentHead = projectFile("client", "index.html");

    expect(shell).toContain(selectedLogo);
    expect(shell).toContain('aria-label="StudentGPT home"');
    expect(shell).toContain("Home</Link>");
    expect(login).toContain(selectedLogo);
    expect(documentHead).toContain(selectedLogo);
  });
});
