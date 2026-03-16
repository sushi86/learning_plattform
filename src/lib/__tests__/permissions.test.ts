import { describe, it, expect } from "vitest";
import { canUseAi } from "../permissions";

describe("canUseAi", () => {
  it("returns true when aiEnabled is true", () => {
    expect(canUseAi({ aiEnabled: true })).toBe(true);
  });

  it("returns false when aiEnabled is false", () => {
    expect(canUseAi({ aiEnabled: false })).toBe(false);
  });

  it("returns false when aiEnabled is undefined", () => {
    expect(canUseAi({ aiEnabled: undefined as unknown as boolean })).toBe(false);
  });
});
