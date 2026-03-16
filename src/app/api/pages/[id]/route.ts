import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Helper: Check if a user has access to a page's workspace.
 * Returns the page with workspace info, or null.
 */
async function getPageWithAccess(pageId: string, userId: string) {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: {
      workspace: {
        select: { ownerId: true },
      },
    },
  });

  if (!page) return null;

  // Check if user is owner
  if (page.workspace.ownerId === userId) return page;

  // Check if user is member
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: page.workspaceId,
        userId,
      },
    },
  });

  if (membership) return page;

  return null;
}

/**
 * PATCH /api/pages/[id]
 * Update a page (title, sortOrder).
 * Both teachers and students can update title/sortOrder.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const page = await getPageWithAccess(id, session.user.id);

  if (!page) {
    return NextResponse.json(
      { error: "Page not found or no access" },
      { status: 404 },
    );
  }

  const body = await request.json();
  const { title, sortOrder } = body;

  const data: { title?: string | null; sortOrder?: number } = {};

  if (title !== undefined) {
    if (typeof title === "string" && title.trim().length > 200) {
      return NextResponse.json(
        { error: "Title must be 200 characters or less" },
        { status: 400 },
      );
    }
    data.title = title?.trim() || null;
  }

  if (sortOrder !== undefined) {
    if (typeof sortOrder !== "number") {
      return NextResponse.json(
        { error: "sortOrder must be a number" },
        { status: 400 },
      );
    }
    data.sortOrder = sortOrder;
  }

  const updated = await prisma.page.update({
    where: { id },
    data,
    select: {
      id: true,
      title: true,
      sortOrder: true,
      backgroundType: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/pages/[id]
 * Delete a page. Teacher (workspace owner) only.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const page = await prisma.page.findUnique({
    where: { id },
    include: {
      workspace: {
        select: { ownerId: true },
      },
    },
  });

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  // Only teachers (workspace owners) can delete pages
  if (page.workspace.ownerId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the workspace owner can delete pages" },
      { status: 403 },
    );
  }

  await prisma.page.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
