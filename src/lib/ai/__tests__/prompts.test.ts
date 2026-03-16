import { describe, it, expect } from "vitest";
import { SOLVE_PROMPT, CHECK_PROMPT, buildExplainPrompt } from "../prompts";

describe("AI prompts", () => {
  it("SOLVE_PROMPT contains JSON format instruction", () => {
    expect(SOLVE_PROMPT).toContain('"steps"');
    expect(SOLVE_PROMPT).toContain('"proof"');
  });

  it("CHECK_PROMPT contains rule field", () => {
    expect(CHECK_PROMPT).toContain('"rule"');
    expect(CHECK_PROMPT).toContain('"hint"');
  });

  it("buildExplainPrompt interpolates steps and question", () => {
    const result = buildExplainPrompt(
      [{ text: "2x = 6", explanation: "simplified" }],
      "2x = 6",
      "Warum?",
    );
    expect(result).toContain("2x = 6");
    expect(result).toContain("Warum?");
    expect(result).toContain("simplified");
  });
});
