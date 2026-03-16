import type { NextAuthConfig } from "next-auth";
import "@/lib/auth.types";

/**
 * Base auth configuration WITHOUT Prisma dependencies.
 * Safe to import in Edge runtime (middleware).
 */
export const authConfig: NextAuthConfig = {
  providers: [], // Providers added in auth.ts (server-side only)
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Protected routes: redirect to login if not authenticated
      const protectedPaths = ["/dashboard", "/workspace"];
      const isProtectedRoute = protectedPaths.some((path) =>
        pathname.startsWith(path),
      );

      if (isProtectedRoute && !isLoggedIn) {
        return false; // Redirects to signIn page
      }

      // Auth routes: redirect to dashboard if already authenticated
      // Exception: if invite token present, redirect to invite page instead
      const authPaths = ["/login", "/register"];
      const isAuthRoute = authPaths.some((path) => pathname.startsWith(path));

      if (isAuthRoute && isLoggedIn) {
        const inviteToken = nextUrl.searchParams.get("invite");
        if (inviteToken) {
          return Response.redirect(
            new URL(`/invite/${inviteToken}`, nextUrl.origin),
          );
        }
        return Response.redirect(new URL("/dashboard", nextUrl.origin));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: string }).role;
        token.aiEnabled = (user as { aiEnabled: boolean }).aiEnabled;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.aiEnabled = token.aiEnabled as boolean;
      }
      return session;
    },
  },
};
