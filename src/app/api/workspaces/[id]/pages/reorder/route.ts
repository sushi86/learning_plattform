import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PUT /api/workspaces/[id]/pages/reorder
 * Reorder pages within a workspace.
 * Accepts an array of { id, sortOrder } objects.
 * Both teachers and students can reorder.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: workspaceId } = await params;
  const userId = session.user.id;

  // Check access: owner or member
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 },
    );
  }

  if (workspace.ownerId !== userId) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await request.json();
  const { pages } = body;

  if (!Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json(
      { error: "Pages array is required" },
      { status: 400 },
    );
  }

  // Validate each entry
  for (const entry of pages) {
    if (!entry.id || typeof entry.sortOrder !== "number") {
      return NextResponse.json(
        { error: "Each entry must have id and sortOrder (number)" },
        { status: 400 },
      );
    }
  }

  // Update all pages in a transaction
  await prisma.$transaction(
    pages.map((entry: { id: string; sortOrder: number }) =>
      prisma.page.update({
        where: { id: entry.id, workspaceId },
        data: { sortOrder: entry.sortOrder },
      }),
    ),
  );

  // Return updated page list
  const updatedPages = await prisma.page.findMany({
    where: { workspaceId },
    select: {
      id: true,
      title: true,
      sortOrder: true,
      backgroundType: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(updatedPages);
}
