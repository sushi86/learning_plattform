/**
 * WebSocket Authentication & Authorization
 *
 * Validates JWT tokens from WebSocket handshake requests
 * and checks workspace membership for page access.
 * Uses the NextAuth decode function for compatibility with Auth.js v5 JWE tokens.
 */
import { decode } from "@auth/core/jwt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export interface WsUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/* ---------- Prisma (standalone for server context) ---------- */

function createPrisma() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

const prisma = createPrisma();

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
 * Check if a user can access a page via its workspace.
 * Returns true if the user is the workspace owner or a member.
 */
export async function canAccessPageWs(
  userId: string,
  pageId: string,
): Promise<boolean> {
  try {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: {
        workspace: {
          select: {
            ownerId: true,
          },
        },
        workspaceId: true,
      },
    });

    if (!page) return false;

    // Owner has access
    if (page.workspace.ownerId === userId) return true;

    // Check membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: page.workspaceId,
          userId,
        },
      },
      select: { id: true },
    });

    return !!membership;
  } catch (err) {
    console.error("[ws-auth] Workspace access check failed:", err);
    return false;
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
