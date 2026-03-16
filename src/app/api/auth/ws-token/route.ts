/**
 * API endpoint to get a WebSocket authentication token.
 *
 * NextAuth stores the JWT in an httpOnly cookie that JavaScript can't access.
 * This endpoint reads the session cookie and returns the raw JWT token
 * so the client can pass it to the WebSocket connection.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

export async function GET() {
  // Verify the user is authenticated
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read the session token cookie directly
  const cookieStore = await cookies();
  const tokenCookie =
    cookieStore.get("authjs.session-token") ||
    cookieStore.get("__Secure-authjs.session-token");

  if (!tokenCookie?.value) {
    return NextResponse.json(
      { error: "No session token found" },
      { status: 401 },
    );
  }

  return NextResponse.json({ token: tokenCookie.value });
}
