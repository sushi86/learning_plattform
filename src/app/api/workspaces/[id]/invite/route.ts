import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageInvites } from "@/lib/permissions";

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

  const { id: workspaceId } = await params;

  // Verify workspace exists
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace nicht gefunden" },
      { status: 404 },
    );
  }

  const canInvite = await canManageInvites(session.user.id, workspaceId);
  if (!canInvite) {
    return NextResponse.json(
      { error: "Nur der Workspace-Besitzer kann Einladungslinks erstellen" },
      { status: 403 },
    );
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

  return NextResponse.json(
    {
      id: inviteLink.id,
      token: inviteLink.token,
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

  const { id: workspaceId } = await params;

  // Verify workspace exists
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace nicht gefunden" },
      { status: 404 },
    );
  }

  const canInvite = await canManageInvites(session.user.id, workspaceId);
  if (!canInvite) {
    return NextResponse.json(
      { error: "Nur der Workspace-Besitzer kann Einladungslinks verwalten" },
      { status: 403 },
    );
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
