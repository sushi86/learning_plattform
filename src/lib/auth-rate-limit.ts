import { NextRequest, NextResponse } from "next/server";
import { RateLimiter } from "@/lib/ai/rate-limit";

// Login: 5 attempts per minute per IP
export const loginRateLimiter = new RateLimiter(5, 60 * 1000);

// Registration: 3 accounts per hour per IP
export const registerRateLimiter = new RateLimiter(3, 60 * 60 * 1000);

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function rateLimitResponse() {
  return NextResponse.json(
    { error: "Zu viele Anfragen. Bitte versuche es später erneut." },
    { status: 429 },
  );
}
