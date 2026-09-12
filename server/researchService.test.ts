import { describe, expect, it } from "vitest";
import { createResearchMarkdown } from "./researchService";

describe("research document export", () => {
  it("formats owned source links and transparent community result labels into Markdown", () => {
    const markdown = createResearchMarkdown({ title: "Learning theory", researchQuestion: "How do students learn?", overview: "An orientation.", keyConcepts: [{ name: "Retrieval", explanation: "Practice recalling." }], studyQuestions: ["Why retrieve?"], actionPlan: ["Practise daily."], boardContent: { projectFocus: "A study design problem.", objectives: ["Identify retrieval practice."], methodology: ["Compare recall conditions."], applications: ["Plan revision."], misconceptions: ["Recognition is not recall."], verificationChecklist: ["Check primary research." ] }, sources: [{ title: "Course text", url: "https://example.edu/text", note: "Chapter 1." }], videos: [{ title: "Lecture", url: "https://youtube.com/watch?v=example", relevance: "retrieval match" }], community: [{ source: "Reddit", title: "Student discussion", url: "https://reddit.com/r/study/example", snippet: "A public perspective." }] });
    expect(markdown).toContain("# Learning theory");
    expect(markdown).toContain("[Reddit] Student discussion");
    expect(markdown).toContain("https://example.edu/text");
    expect(markdown).toContain("## Methodology and study approach");
    expect(markdown).toContain("Recognition is not recall.");
    expect(markdown).toContain("Relevance: retrieval match");
  });
});
