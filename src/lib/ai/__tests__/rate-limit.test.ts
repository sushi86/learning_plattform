import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimiter } from "../rate-limit";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(3, 60_000);
  });

  it("allows requests under the limit", () => {
    expect(limiter.check("user1")).toBe(true);
    expect(limiter.check("user1")).toBe(true);
    expect(limiter.check("user1")).toBe(true);
  });

  it("blocks requests over the limit", () => {
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");
    expect(limiter.check("user1")).toBe(false);
  });

  it("tracks users independently", () => {
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");
    expect(limiter.check("user1")).toBe(false);
    expect(limiter.check("user2")).toBe(true);
  });

  it("resets after window expires", () => {
    vi.useFakeTimers();
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");
    expect(limiter.check("user1")).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(limiter.check("user1")).toBe(true);
    vi.useRealTimers();
  });
});
