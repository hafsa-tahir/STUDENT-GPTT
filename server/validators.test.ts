import { describe, expect, it } from "vitest";
import { chatMessageInput, courseInput, flashcardGenerationInput, quizGenerationInput, studyPlanInput, studyPlanItemInput, studySessionInput, subjectInput, topicInput } from "./validators";

describe("academic input validation", () => {
  it("accepts a complete subject and applies its default color", () => {
    expect(subjectInput.parse({ name: "Calculus", description: "Limits and integration" })).toEqual({
      name: "Calculus",
      description: "Limits and integration",
      color: "#4f46e5",
    });
  });

  it("rejects blank names and malformed subject colors", () => {
    expect(() => subjectInput.parse({ name: "   ", color: "blue" })).toThrow();
  });

  it("requires owned parent identifiers for courses and topics", () => {
    expect(() => courseInput.parse({ subjectId: 0, name: "Linear algebra" })).toThrow();
    expect(() => topicInput.parse({ subjectId: 1, courseId: -2, name: "Matrices" })).toThrow();
  });

  it("accepts bounded study-plan sessions and rejects invalid time estimates", () => {
    expect(studyPlanInput.parse({ title: "Physics final", subjectId: 2, examDate: new Date("2026-06-14T12:00:00Z") }).title).toBe("Physics final");
    expect(() => studyPlanItemInput.parse({ planId: 2, title: "Review forces", estimatedMinutes: 1 })).toThrow();
    expect(studySessionInput.parse({ planItemId: 2, startedAt: new Date("2026-06-10T10:00:00Z"), endedAt: new Date("2026-06-10T10:30:00Z"), minutesStudied: 30 }).minutesStudied).toBe(30);
    expect(() => studySessionInput.parse({ startedAt: new Date(), minutesStudied: 0 })).toThrow();
  });

  it("allows an existing task note to be explicitly cleared", () => {
    expect(studyPlanItemInput.parse({ planId: 2, title: "Review forces", estimatedMinutes: 45, notes: null }).notes).toBeNull();
  });

  it("requires a bounded study-chat request", () => {
    expect(chatMessageInput.parse({ conversationId: 4, content: "Explain conservation of energy." }).conversationId).toBe(4);
    expect(() => chatMessageInput.parse({ conversationId: 0, content: "x" })).toThrow();
    expect(() => chatMessageInput.parse({ conversationId: 4, content: "x".repeat(12001) })).toThrow();
  });

  it("requires bounded real learning-artifact generation inputs", () => {
    expect(quizGenerationInput.parse({ title: "Biology review", topic: "Cell respiration", difficulty: "medium", documentId: 7 }).documentId).toBe(7);
    expect(flashcardGenerationInput.parse({ topic: "Neural pathways", documentId: 8 }).documentId).toBe(8);
    expect(() => quizGenerationInput.parse({ title: "", topic: "Cell respiration", difficulty: "medium" })).toThrow();
  });
});
