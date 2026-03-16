"use client";

import { useRef, useCallback, useState } from "react";
import { useToast } from "@/components/ui/toast";
import type { ImageShape } from "./types";
import { createShapeId } from "./types";
import { uploadFile } from "./uploadFile";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 20;

interface FileUploadButtonProps {
  pageId: string;
  onAddImage: (shape: ImageShape) => void;
}

async function renderPdfPages(file: File): Promise<Blob[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const blobs: Blob[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    });
    blobs.push(blob);
  }
  return blobs;
}

export function FileUploadButton({ pageId, onAddImage }: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);

  const placeImage = useCallback(async (url: string, index: number = 0) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.src = url;
    });

    const maxWidth = 600;
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;

    const shape: ImageShape = {
      id: createShapeId(),
      type: "image",
      x: 100,
      y: 100 + index * (h + 20),
      color: "#000000",
      props: { src: url, width: w, height: h },
    };

    onAddImage(shape);
  }, [onAddImage]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast("Ungültiger Dateityp. Erlaubt: PNG, JPG, WEBP, PDF", "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast("Datei ist zu groß. Maximum: 10MB", "error");
      return;
    }

    setUploading(true);
    try {
      if (file.type === "application/pdf") {
        showToast("PDF wird verarbeitet...", "info");
        let pageBlobs: Blob[];
        try { pageBlobs = await renderPdfPages(file); } catch {
          showToast("PDF konnte nicht verarbeitet werden", "error");
          setUploading(false);
          return;
        }
        if (pageBlobs.length === 0) { showToast("PDF enthält keine Seiten", "error"); setUploading(false); return; }
        const pdfName = file.name.replace(/\.pdf$/i, "");
        for (let i = 0; i < pageBlobs.length; i++) {
          const result = await uploadFile(pageBlobs[i], pageId, `${pdfName}_seite_${i + 1}.png`);
          await placeImage(result.url, i);
        }
        showToast(`PDF hochgeladen: ${pageBlobs.length} Seiten`, "success");
      } else {
        const result = await uploadFile(file, pageId);
        await placeImage(result.url);
        showToast("Bild hochgeladen", "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload fehlgeschlagen", "error");
    } finally {
      setUploading(false);
    }
  }, [pageId, showToast, placeImage]);

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" className="hidden" onChange={handleFileChange} />
      <button
        className="flex items-center justify-center w-9 h-9 rounded-lg text-sm hover:bg-gray-100 text-gray-700"
        title="Datei hochladen (Bild / PDF)"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{ opacity: uploading ? 0.5 : 1, cursor: uploading ? "wait" : "pointer" }}
      >
        {uploading ? (
          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        )}
      </button>
    </>
  );
}
