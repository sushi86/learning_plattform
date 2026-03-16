import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

/**
 * GET /api/workspaces/[id]
 * Get a single workspace. User must be owner or member.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 },
    );
  }

  // Check access: owner or member
  if (workspace.ownerId !== userId) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: id, userId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(workspace);
}

/**
 * DELETE /api/workspaces/[id]
 * Teachers only (owner): delete workspace with cascade
 * Also cleans up uploaded files from the filesystem
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Check ownership
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 },
    );
  }

  if (workspace.ownerId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the owner can delete this workspace" },
      { status: 403 },
    );
  }

  // Get file uploads to clean up from filesystem
  const fileUploads = await prisma.fileUpload.findMany({
    where: {
      page: {
        workspaceId: id,
      },
    },
    select: { storagePath: true },
  });

  // Delete workspace (cascades to pages, members, invite links via Prisma)
  await prisma.workspace.delete({
    where: { id },
  });

  // Clean up files from filesystem (best effort)
  for (const file of fileUploads) {
    try {
      const fullPath = path.resolve(file.storagePath);
      await fs.unlink(fullPath);
    } catch {
      // File may already be deleted or missing — ignore
    }
  }

  return NextResponse.json({ success: true });
}
