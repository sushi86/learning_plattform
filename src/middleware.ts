import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Edge-compatible middleware using auth config WITHOUT Prisma.
 * Uses the `authorized` callback in auth.config.ts for route protection.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/dashboard/:path*", "/workspace/:path*", "/login", "/register"],
};
