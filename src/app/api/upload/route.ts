import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getUploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || "./uploads");
}

/**
 * POST /api/upload
 * Upload a file (image or PDF). Requires authentication.
 * Body: multipart/form-data with fields: file, pageId
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage" },
      { status: 400 },
    );
  }

  const file = formData.get("file") as File | null;
  const pageId = formData.get("pageId") as string | null;

  if (!file || !pageId) {
    return NextResponse.json(
      { error: "Datei und Seiten-ID sind erforderlich" },
      { status: 400 },
    );
  }

  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        error: "Ungültiger Dateityp. Erlaubt: PNG, JPG, WEBP, PDF",
      },
      { status: 400 },
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Datei ist zu groß. Maximum: 10MB" },
      { status: 400 },
    );
  }

  // Check that user has access to the page's workspace
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      workspace: {
        select: {
          id: true,
          ownerId: true,
          members: { where: { userId }, select: { id: true } },
        },
      },
    },
  });

  if (!page) {
    return NextResponse.json(
      { error: "Seite nicht gefunden" },
      { status: 404 },
    );
  }

  const ws = page.workspace;
  if (ws.ownerId !== userId && ws.members.length === 0) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  // Generate unique filename
  const ext = path.extname(file.name) || mimeToExt(file.type);
  const uniqueName = `${crypto.randomUUID()}${ext}`;

  const uploadDir = getUploadDir();
  const storagePath = path.join(uploadDir, uniqueName);

  // Ensure upload directory exists
  await fs.mkdir(uploadDir, { recursive: true });

  // Write file to disk
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storagePath, buffer);

  // Create DB record
  const fileUpload = await prisma.fileUpload.create({
    data: {
      pageId,
      uploadedById: userId,
      filename: file.name,
      mimeType: file.type,
      storagePath,
      fileSize: file.size,
    },
  });

  return NextResponse.json({
    id: fileUpload.id,
    filename: fileUpload.filename,
    mimeType: fileUpload.mimeType,
    fileSize: fileUpload.fileSize,
    url: `/api/files/${fileUpload.id}`,
  });
}

function mimeToExt(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    default:
      return "";
  }
}
