import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";

/**
 * GET /api/files/[id]
 * Serve an uploaded file. User must be workspace member or owner.
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

  const fileUpload = await prisma.fileUpload.findUnique({
    where: { id },
    select: {
      mimeType: true,
      filename: true,
      storagePath: true,
      page: {
        select: {
          workspace: {
            select: {
              ownerId: true,
              members: { where: { userId }, select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!fileUpload) {
    return NextResponse.json(
      { error: "Datei nicht gefunden" },
      { status: 404 },
    );
  }

  // Auth check: user must be workspace owner or member
  const ws = fileUpload.page.workspace;
  if (ws.ownerId !== userId && ws.members.length === 0) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  // Read and serve file
  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(fileUpload.storagePath);
  } catch {
    return NextResponse.json(
      { error: "Datei nicht gefunden auf dem Server" },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": fileUpload.mimeType,
      "Content-Disposition": `inline; filename="${fileUpload.filename}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
