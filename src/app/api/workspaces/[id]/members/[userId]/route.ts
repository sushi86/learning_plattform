import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageMembers } from "@/lib/permissions";

/**
 * DELETE /api/workspaces/[id]/members/[userId]
 * Remove a student from a workspace. Teacher (owner) only.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: workspaceId, userId: targetUserId } = await params;

  // Verify workspace exists
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace nicht gefunden" },
      { status: 404 },
    );
  }

  // Only the owner can remove members
  const canManage = await canManageMembers(session.user.id, workspaceId);
  if (!canManage) {
    return NextResponse.json(
      { error: "Nur der Workspace-Besitzer kann Mitglieder entfernen" },
      { status: 403 },
    );
  }

  // Prevent owner from removing themselves
  if (targetUserId === workspace.ownerId) {
    return NextResponse.json(
      { error: "Der Workspace-Besitzer kann nicht entfernt werden" },
      { status: 400 },
    );
  }

  // Find and delete the membership
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: targetUserId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Mitglied nicht gefunden" },
      { status: 404 },
    );
  }

  await prisma.workspaceMember.delete({
    where: { id: membership.id },
  });

  return NextResponse.json({ success: true });
}
