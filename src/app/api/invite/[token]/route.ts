import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/invite/[token]
 * Get invite info (workspace name, teacher name, validity).
 * Public endpoint — no auth required.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const inviteLink = await prisma.inviteLink.findUnique({
    where: { token },
    include: {
      workspace: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { name: true },
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

  return NextResponse.json({
    workspaceName: inviteLink.workspace.name,
    workspaceId: inviteLink.workspace.id,
    teacherName: inviteLink.createdBy.name,
    expiresAt: inviteLink.expiresAt,
  });
}
