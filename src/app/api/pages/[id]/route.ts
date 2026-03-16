import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessPage, canDeletePage } from "@/lib/permissions";

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

  const access = await canAccessPage(session.user.id, id);
  if (!access) {
    return NextResponse.json(
      { error: "Seite nicht gefunden oder kein Zugriff" },
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
    select: { workspaceId: true },
  });

  if (!page) {
    return NextResponse.json(
      { error: "Seite nicht gefunden" },
      { status: 404 },
    );
  }

  const canDelete = await canDeletePage(session.user.id, page.workspaceId);
  if (!canDelete) {
    return NextResponse.json(
      { error: "Nur der Workspace-Besitzer kann Seiten löschen" },
      { status: 403 },
    );
  }

  await prisma.page.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
