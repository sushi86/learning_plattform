/**
 * WebSocket Authentication
 *
 * Validates JWT tokens from WebSocket handshake requests.
 * Uses the NextAuth decode function for compatibility with Auth.js v5 JWE tokens.
 */
import { decode } from "@auth/core/jwt";

interface WsUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * Verify a NextAuth JWT token and extract user info.
 * NextAuth v5 uses JWE (encrypted JWTs) via jose, so we use its decode function.
 */
export async function authenticateWsToken(
  token: string | null | undefined,
): Promise<WsUser | null> {
  if (!token) return null;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[ws-auth] NEXTAUTH_SECRET is not set");
    return null;
  }

  try {
    // Use NextAuth's decode which handles JWE decryption
    const payload = await decode({
      token,
      secret,
      salt: "authjs.session-token",
    });

    if (!payload) return null;

    return {
      id: (payload.id as string) || (payload.sub as string) || "",
      name: (payload.name as string) || "Unknown",
      email: (payload.email as string) || "",
      role: (payload.role as string) || "STUDENT",
    };
  } catch (err) {
    console.error("[ws-auth] JWT verification failed:", err);
    return null;
  }
}

/**
 * Extract JWT token from the WebSocket upgrade request.
 * Supports: ?token=<jwt> query parameter.
 */
export function extractTokenFromUrl(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url, "http://localhost");
    return parsedUrl.searchParams.get("token");
  } catch {
    return null;
  }
}

/**
 * Extract page ID from the WebSocket URL path.
 * Expected format: /ws/page/[pageId]
 */
export function extractPageIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url, "http://localhost");
    const match = parsedUrl.pathname.match(/^\/ws\/page\/([^/?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
