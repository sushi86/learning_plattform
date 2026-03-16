interface BucketEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, BucketEntry>();

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  check(userId: string): boolean {
    const now = Date.now();
    const entry = this.buckets.get(userId);

    if (!entry || now >= entry.resetAt) {
      this.buckets.set(userId, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }
}

export const aiRateLimiter = new RateLimiter(20, 60 * 60 * 1000);
