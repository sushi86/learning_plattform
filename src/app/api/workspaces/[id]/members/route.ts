import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace } from "@/lib/permissions";

/**
 * GET /api/workspaces/[id]/members
 * List all members of a workspace.
 * Both owner and members can view the member list.
 */
export async function GET(
  _request: Request,
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
    select: {
      id: true,
      ownerId: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace nicht gefunden" },
      { status: 404 },
    );
  }

  const hasAccess = await canAccessWorkspace(session.user.id, workspaceId);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Kein Zugriff auf diesen Workspace" },
      { status: 403 },
    );
  }

  // Get all members (students)
  const memberships = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const members = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.user.role,
    joinedAt: m.joinedAt,
  }));

  return NextResponse.json({
    owner: workspace.owner,
    members,
  });
}
