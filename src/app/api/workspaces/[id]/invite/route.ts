import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/workspaces/[id]/invite
 * Generate a single-use invite link for a workspace (teacher/owner only).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: workspaceId } = await params;

  // Verify ownership
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace nicht gefunden." },
      { status: 404 },
    );
  }

  if (workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate cryptographically random token
  const token = randomBytes(32).toString("hex");

  // Default expiry: 7 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const inviteLink = await prisma.inviteLink.create({
    data: {
      workspaceId,
      token,
      createdById: session.user.id,
      expiresAt,
    },
  });

  const baseUrl = request.nextUrl.origin;
  const inviteUrl = `${baseUrl}/invite/${token}`;

  return NextResponse.json(
    {
      id: inviteLink.id,
      token: inviteLink.token,
      url: inviteUrl,
      expiresAt: inviteLink.expiresAt,
    },
    { status: 201 },
  );
}

/**
 * GET /api/workspaces/[id]/invite
 * List unused invite links for a workspace (teacher/owner only).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: workspaceId } = await params;

  // Verify ownership
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace nicht gefunden." },
      { status: 404 },
    );
  }

  if (workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const inviteLinks = await prisma.inviteLink.findMany({
    where: {
      workspaceId,
      usedById: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(inviteLinks);
}
