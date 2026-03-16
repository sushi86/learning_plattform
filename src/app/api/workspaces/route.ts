import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCreateWorkspace } from "@/lib/permissions";

/**
 * GET /api/workspaces
 * Teachers: returns owned workspaces
 * Students: returns workspaces they are members of
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, role } = session.user;

  if (role === "TEACHER") {
    const workspaces = await prisma.workspace.findMany({
      where: { ownerId: userId },
      include: {
        _count: {
          select: {
            members: true,
            pages: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(workspaces);
  }

  // STUDENT: workspaces they are members of
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          _count: {
            select: {
              members: true,
              pages: true,
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const workspaces = memberships.map((m) => m.workspace);
  return NextResponse.json(workspaces);
}

/**
 * POST /api/workspaces
 * Teachers only: create a new workspace
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canCreateWorkspace(session.user.role)) {
    return NextResponse.json(
      { error: "Nur Lehrer können Workspaces erstellen" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { name, description } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 },
    );
  }

  if (name.trim().length > 100) {
    return NextResponse.json(
      { error: "Name must be 100 characters or less" },
      { status: 400 },
    );
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      ownerId: session.user.id,
    },
    include: {
      _count: {
        select: {
          members: true,
          pages: true,
        },
      },
    },
  });

  return NextResponse.json(workspace, { status: 201 });
}
