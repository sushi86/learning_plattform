import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/invite/[token]/redeem
 * Redeem an invite link. Creates WorkspaceMember entry.
 * Requires authentication.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;
  const userId = session.user.id;

  const inviteLink = await prisma.inviteLink.findUnique({
    where: { token },
    include: {
      workspace: {
        select: { id: true, name: true },
      },
    },
  });

  if (!inviteLink) {
    return NextResponse.json(
      { error: "Einladungslink nicht gefunden.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // Check if already used
  if (inviteLink.usedById) {
    return NextResponse.json(
      {
        error: "Dieser Einladungslink wurde bereits verwendet.",
        code: "ALREADY_USED",
      },
      { status: 410 },
    );
  }

  // Check if expired
  if (inviteLink.expiresAt && inviteLink.expiresAt < new Date()) {
    return NextResponse.json(
      {
        error: "Dieser Einladungslink ist abgelaufen.",
        code: "EXPIRED",
      },
      { status: 410 },
    );
  }

  // Check if user is already a member
  const existingMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: inviteLink.workspaceId,
        userId,
      },
    },
  });

  if (existingMember) {
    return NextResponse.json({
      message: "Du bist bereits Mitglied dieses Workspace.",
      workspaceId: inviteLink.workspaceId,
      alreadyMember: true,
    });
  }

  // Check if user is the workspace owner
  const workspace = await prisma.workspace.findUnique({
    where: { id: inviteLink.workspaceId },
  });

  if (workspace?.ownerId === userId) {
    return NextResponse.json({
      message: "Du bist der Besitzer dieses Workspace.",
      workspaceId: inviteLink.workspaceId,
      alreadyMember: true,
    });
  }

  // Redeem: create membership and mark invite as used (transaction)
  await prisma.$transaction([
    prisma.workspaceMember.create({
      data: {
        workspaceId: inviteLink.workspaceId,
        userId,
      },
    }),
    prisma.inviteLink.update({
      where: { id: inviteLink.id },
      data: {
        usedById: userId,
        usedAt: new Date(),
      },
    }),
  ]);

  return NextResponse.json({
    message: "Erfolgreich dem Workspace beigetreten!",
    workspaceId: inviteLink.workspaceId,
    workspaceName: inviteLink.workspace.name,
  });
}
