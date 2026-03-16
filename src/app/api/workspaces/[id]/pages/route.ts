import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/workspaces/[id]/pages
 * List all pages for a workspace, sorted by sortOrder.
 * User must be owner or member of the workspace.
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

  const pages = await prisma.page.findMany({
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

  return NextResponse.json(pages);
}

/**
 * POST /api/workspaces/[id]/pages
 * Create a new page in the workspace.
 * Both teachers (owner) and students (member) can add pages.
 * Uses gap-based sortOrder (1000, 2000, 3000...).
 */
export async function POST(
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
  const { title, backgroundType } = body;

  // Validate backgroundType
  const validTypes = ["BLANK", "GRID", "LINED", "COORDINATE"];
  if (backgroundType && !validTypes.includes(backgroundType)) {
    return NextResponse.json(
      { error: "Invalid background type" },
      { status: 400 },
    );
  }

  if (title && typeof title === "string" && title.trim().length > 200) {
    return NextResponse.json(
      { error: "Title must be 200 characters or less" },
      { status: 400 },
    );
  }

  // Get the highest sortOrder to append at the end
  const lastPage = await prisma.page.findFirst({
    where: { workspaceId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const sortOrder = lastPage ? lastPage.sortOrder + 1000 : 1000;

  const page = await prisma.page.create({
    data: {
      workspaceId,
      title: title?.trim() || null,
      sortOrder,
      backgroundType: backgroundType || "BLANK",
    },
    select: {
      id: true,
      title: true,
      sortOrder: true,
      backgroundType: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(page, { status: 201 });
}
