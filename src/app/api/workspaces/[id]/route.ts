import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace, canDeleteWorkspace } from "@/lib/permissions";
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
      { error: "Workspace nicht gefunden" },
      { status: 404 },
    );
  }

  const hasAccess = await canAccessWorkspace(session.user.id, id);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Kein Zugriff auf diesen Workspace" },
      { status: 403 },
    );
  }

  return NextResponse.json(workspace);
}

/**
 * DELETE /api/workspaces/[id]
 * Owner only: delete workspace with cascade.
 * Also cleans up uploaded files from the filesystem.
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

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace nicht gefunden" },
      { status: 404 },
    );
  }

  const canDelete = await canDeleteWorkspace(session.user.id, id);
  if (!canDelete) {
    return NextResponse.json(
      { error: "Nur der Workspace-Besitzer kann diesen Workspace löschen" },
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
