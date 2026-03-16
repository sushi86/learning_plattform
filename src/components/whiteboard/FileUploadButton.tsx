"use client";

import { useRef, useCallback, useState } from "react";
import {
  useEditor,
  track,
  createShapeId,
  AssetRecordType,
} from "tldraw";
import { useToast } from "@/components/ui/toast";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_PAGES = 20;

interface FileUploadButtonProps {
  pageId: string;
}

async function uploadFile(
  file: File | Blob,
  pageId: string,
  filename?: string,
): Promise<{ id: string; url: string; mimeType: string }> {
  const formData = new FormData();
  if (filename && file instanceof Blob && !(file instanceof File)) {
    formData.append("file", file, filename);
  } else {
    formData.append("file", file);
  }
  formData.append("pageId", pageId);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload fehlgeschlagen");
  }

  return res.json();
}

async function renderPdfPages(file: File): Promise<Blob[]> {
  const pdfjsLib = await import("pdfjs-dist");

  // Set worker source (served from public/)
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const blobs: Blob[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 }); // 2x for good quality

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdf.js types don't match exactly
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas to blob failed"))),
        "image/png",
      );
    });

    blobs.push(blob);
  }

  return blobs;
}

export const FileUploadButton = track(function FileUploadButton({
  pageId,
}: FileUploadButtonProps) {
  const editor = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);

  const placeImageOnCanvas = useCallback(
    async (url: string, index: number = 0) => {
      // Load image to get dimensions
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
        img.src = url;
      });

      const assetId = AssetRecordType.createId();
      const shapeId = createShapeId();

      // Create asset
      editor.createAssets([
        {
          id: assetId,
          type: "image",
          typeName: "asset",
          props: {
            name: "upload",
            src: url,
            w: img.naturalWidth,
            h: img.naturalHeight,
            mimeType: "image/png",
            isAnimated: false,
          },
          meta: {},
        },
      ]);

      // Calculate position — center of viewport, offset by index for multiple pages
      const viewportCenter = editor.getViewportScreenCenter();
      const pagePoint = editor.screenToPage(viewportCenter);

      // Scale image to a reasonable size (max 600px wide)
      const maxWidth = 600;
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;

      editor.createShape({
        id: shapeId,
        type: "image",
        x: pagePoint.x - w / 2,
        y: pagePoint.y - h / 2 + index * (h + 20),
        props: {
          assetId,
          w,
          h,
        },
      });
    },
    [editor],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input so the same file can be selected again
      e.target.value = "";

      // Validate type
      if (!ALLOWED_TYPES.includes(file.type)) {
        showToast(
          "Ungültiger Dateityp. Erlaubt: PNG, JPG, WEBP, PDF",
          "error",
        );
        return;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        showToast("Datei ist zu groß. Maximum: 10MB", "error");
        return;
      }

      setUploading(true);

      try {
        if (file.type === "application/pdf") {
          // PDF: render pages to images, upload each
          showToast("PDF wird verarbeitet...", "info");

          let pageBlobs: Blob[];
          try {
            pageBlobs = await renderPdfPages(file);
          } catch {
            showToast("PDF konnte nicht verarbeitet werden", "error");
            setUploading(false);
            return;
          }

          if (pageBlobs.length === 0) {
            showToast("PDF enthält keine Seiten", "error");
            setUploading(false);
            return;
          }

          const pdfName = file.name.replace(/\.pdf$/i, "");

          for (let i = 0; i < pageBlobs.length; i++) {
            const filename = `${pdfName}_seite_${i + 1}.png`;
            const result = await uploadFile(pageBlobs[i], pageId, filename);
            await placeImageOnCanvas(result.url, i);
          }

          showToast(
            `PDF hochgeladen: ${pageBlobs.length} Seiten`,
            "success",
          );
        } else {
          // Image: upload directly
          const result = await uploadFile(file, pageId);
          await placeImageOnCanvas(result.url);
          showToast("Bild hochgeladen", "success");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload fehlgeschlagen";
        showToast(message, "error");
      } finally {
        setUploading(false);
      }
    },
    [pageId, showToast, placeImageOnCanvas],
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        className="tlui-toolbar__button"
        title="Datei hochladen (Bild / PDF)"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          border: "none",
          background: "transparent",
          cursor: uploading ? "wait" : "pointer",
          opacity: uploading ? 0.5 : 1,
          borderRadius: 6,
        }}
      >
        {uploading ? (
          <svg
            className="animate-spin"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </button>
    </>
  );
});
