import { describe, it, expect } from "vitest";
import { validateSolveResponse, validateCheckResponse, validateExplainResponse } from "../provider";

describe("validateSolveResponse", () => {
  it("accepts valid response", () => {
    const res = { steps: [{ text: "x=3", explanation: "solved" }], proof: "check" };
    expect(validateSolveResponse(res)).toEqual(res);
  });

  it("rejects response without steps", () => {
    expect(() => validateSolveResponse({ proof: "check" })).toThrow();
  });

  it("rejects response with empty steps", () => {
    expect(() => validateSolveResponse({ steps: [] })).toThrow();
  });

  it("accepts response without proof", () => {
    const res = { steps: [{ text: "x=3", explanation: "solved" }] };
    expect(validateSolveResponse(res)).toEqual(res);
  });
});

describe("validateCheckResponse", () => {
  it("accepts valid response", () => {
    const res = {
      correct: true,
      steps: [{ studentStep: "x=3", isCorrect: true }],
      hint: "Good job",
    };
    expect(validateCheckResponse(res)).toEqual(res);
  });

  it("rejects response without hint", () => {
    expect(() => validateCheckResponse({ correct: true, steps: [] })).toThrow();
  });
});

describe("validateExplainResponse", () => {
  it("accepts valid response", () => {
    const res = { explanation: "Because..." };
    expect(validateExplainResponse(res)).toEqual(res);
  });

  it("rejects response without explanation", () => {
    expect(() => validateExplainResponse({})).toThrow();
  });
});
