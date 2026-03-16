import { jsPDF } from "jspdf";
import type { BackgroundType } from "@/components/whiteboard/types";
import {
  A4_WIDTH_PX,
  A4_HEIGHT_PX,
  GRID_SPACING_PX,
  LINE_SPACING_PX,
  COORD_GRID_SPACING_PX,
} from "@/components/whiteboard/types";

/* ---------- Types ---------- */

export interface PdfPageData {
  id: string;
  title: string | null;
  backgroundType: BackgroundType;
  sortOrder: number;
}

export interface PdfExportOptions {
  pages: PdfPageData[];
  workspaceName: string;
  /** tldraw editor instance for the currently active page */
  getEditorSvg?: () => Promise<{ svg: string; width: number; height: number } | null>;
  activePageId?: string | null;
  onProgress?: (current: number, total: number) => void;
}

/* ---------- A4 dimensions in mm (for jsPDF) ---------- */

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/* ---------- Background SVG generators ---------- */

function generateBlankSvg(): string {
  return `<svg width="${A4_WIDTH_PX}" height="${A4_HEIGHT_PX}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
  </svg>`;
}

function generateGridSvg(): string {
  const s = GRID_SPACING_PX;
  return `<svg width="${A4_WIDTH_PX}" height="${A4_HEIGHT_PX}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <defs>
      <pattern id="grid-5mm" width="${s}" height="${s}" patternUnits="userSpaceOnUse">
        <path d="M ${s} 0 L 0 0 0 ${s}" fill="none" stroke="#d4d4d8" stroke-width="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid-5mm)"/>
  </svg>`;
}

function generateLinedSvg(): string {
  const spacing = LINE_SPACING_PX;
  const topMargin = 113;
  let lines = "";
  for (let y = topMargin; y < A4_HEIGHT_PX; y += spacing) {
    lines += `<line x1="0" y1="${y}" x2="${A4_WIDTH_PX}" y2="${y}" stroke="#bfdbfe" stroke-width="0.7"/>`;
  }
  return `<svg width="${A4_WIDTH_PX}" height="${A4_HEIGHT_PX}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    ${lines}
  </svg>`;
}

function generateCoordinateSvg(): string {
  const spacing = COORD_GRID_SPACING_PX;
  const originX = Math.round(A4_WIDTH_PX / 2);
  const originY = Math.round(A4_HEIGHT_PX / 2);

  let gridLines = "";

  // Vertical grid lines
  for (let x = originX % spacing; x < A4_WIDTH_PX; x += spacing) {
    gridLines += `<line x1="${x}" y1="0" x2="${x}" y2="${A4_HEIGHT_PX}" stroke="#e4e4e7" stroke-width="0.5"/>`;
  }
  // Horizontal grid lines
  for (let y = originY % spacing; y < A4_HEIGHT_PX; y += spacing) {
    gridLines += `<line x1="0" y1="${y}" x2="${A4_WIDTH_PX}" y2="${y}" stroke="#e4e4e7" stroke-width="0.5"/>`;
  }

  let labels = "";
  const labelOffset = 12;

  // X-axis labels
  for (let x = originX + spacing; x < A4_WIDTH_PX - 20; x += spacing * 2) {
    const value = Math.round((x - originX) / spacing);
    labels += `<text x="${x}" y="${originY + labelOffset + 4}" text-anchor="middle" font-size="9" fill="#71717a" font-family="sans-serif">${value}</text>`;
  }
  for (let x = originX - spacing; x > 20; x -= spacing * 2) {
    const value = Math.round((x - originX) / spacing);
    labels += `<text x="${x}" y="${originY + labelOffset + 4}" text-anchor="middle" font-size="9" fill="#71717a" font-family="sans-serif">${value}</text>`;
  }
  // Y-axis labels
  for (let y = originY - spacing; y > 20; y -= spacing * 2) {
    const value = Math.round((originY - y) / spacing);
    labels += `<text x="${originX - labelOffset}" y="${y + 3}" text-anchor="end" font-size="9" fill="#71717a" font-family="sans-serif">${value}</text>`;
  }
  for (let y = originY + spacing; y < A4_HEIGHT_PX - 20; y += spacing * 2) {
    const value = Math.round((originY - y) / spacing);
    labels += `<text x="${originX - labelOffset}" y="${y + 3}" text-anchor="end" font-size="9" fill="#71717a" font-family="sans-serif">${value}</text>`;
  }

  return `<svg width="${A4_WIDTH_PX}" height="${A4_HEIGHT_PX}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    ${gridLines}
    <line x1="0" y1="${originY}" x2="${A4_WIDTH_PX}" y2="${originY}" stroke="#18181b" stroke-width="1.5"/>
    <polygon points="${A4_WIDTH_PX - 8},${originY - 4} ${A4_WIDTH_PX},${originY} ${A4_WIDTH_PX - 8},${originY + 4}" fill="#18181b"/>
    <line x1="${originX}" y1="0" x2="${originX}" y2="${A4_HEIGHT_PX}" stroke="#18181b" stroke-width="1.5"/>
    <polygon points="${originX - 4},8 ${originX},0 ${originX + 4},8" fill="#18181b"/>
    <text x="${A4_WIDTH_PX - 16}" y="${originY - 10}" font-size="12" font-weight="bold" fill="#18181b" font-family="sans-serif">x</text>
    <text x="${originX + 10}" y="18" font-size="12" font-weight="bold" fill="#18181b" font-family="sans-serif">y</text>
    <text x="${originX - 12}" y="${originY + 16}" font-size="9" fill="#71717a" font-family="sans-serif">0</text>
    ${labels}
  </svg>`;
}

const BACKGROUND_SVG_GENERATORS: Record<BackgroundType, () => string> = {
  BLANK: generateBlankSvg,
  GRID: generateGridSvg,
  LINED: generateLinedSvg,
  COORDINATE: generateCoordinateSvg,
};

/* ---------- SVG to Image helper ---------- */

function svgToImage(svgString: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load SVG as image"));

    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    img.src = URL.createObjectURL(blob);
  });
}

/* ---------- Render page to canvas ---------- */

async function renderPageToCanvas(
  backgroundType: BackgroundType,
  contentSvg?: { svg: string; width: number; height: number } | null,
): Promise<HTMLCanvasElement> {
  // Use 2x scale for crisp PDF output
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = A4_WIDTH_PX * scale;
  canvas.height = A4_HEIGHT_PX * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Cannot create canvas context");

  ctx.scale(scale, scale);

  // 1. Draw background
  const bgSvg = BACKGROUND_SVG_GENERATORS[backgroundType]();
  const bgImg = await svgToImage(bgSvg);
  ctx.drawImage(bgImg, 0, 0, A4_WIDTH_PX, A4_HEIGHT_PX);
  URL.revokeObjectURL(bgImg.src);

  // 2. Draw tldraw content overlay (if available)
  if (contentSvg?.svg) {
    try {
      const contentImg = await svgToImage(contentSvg.svg);
      // Center the content on the A4 area (tldraw SVG may have different dimensions)
      const contentScale = Math.min(
        A4_WIDTH_PX / contentSvg.width,
        A4_HEIGHT_PX / contentSvg.height,
        1, // Don't scale up
      );
      const drawWidth = contentSvg.width * contentScale;
      const drawHeight = contentSvg.height * contentScale;
      const offsetX = (A4_WIDTH_PX - drawWidth) / 2;
      const offsetY = (A4_HEIGHT_PX - drawHeight) / 2;

      ctx.drawImage(contentImg, offsetX, offsetY, drawWidth, drawHeight);
      URL.revokeObjectURL(contentImg.src);
    } catch {
      // Content rendering failed — continue with background only
      console.warn("Failed to render tldraw content for PDF page");
    }
  }

  return canvas;
}

/* ---------- Draw page title header ---------- */

function drawTitleOnPdf(
  pdf: jsPDF,
  title: string,
  pageNumber: number,
  totalPages: number,
) {
  // Title in top-left corner
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(title, 10, 8);

  // Page number in top-right corner
  const pageText = `${pageNumber} / ${totalPages}`;
  pdf.text(pageText, A4_WIDTH_MM - 10, 8, { align: "right" });
}

/* ---------- Main export function ---------- */

export async function exportWorkspaceToPdf({
  pages,
  workspaceName,
  getEditorSvg,
  activePageId,
  onProgress,
}: PdfExportOptions): Promise<void> {
  if (pages.length === 0) {
    throw new Error("Keine Seiten zum Exportieren vorhanden.");
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const totalPages = pages.length;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    onProgress?.(i + 1, totalPages);

    // Add new page for all pages after the first
    if (i > 0) {
      pdf.addPage("a4", "portrait");
    }

    // Get tldraw content SVG for the active page
    let contentSvg: { svg: string; width: number; height: number } | null =
      null;
    if (page.id === activePageId && getEditorSvg) {
      try {
        contentSvg = await getEditorSvg();
      } catch {
        // Continue without content
        console.warn("Failed to get editor SVG for active page");
      }
    }

    // Render page (background + content) to canvas
    const canvas = await renderPageToCanvas(page.backgroundType, contentSvg);

    // Add the rendered page as image to PDF
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);

    // Draw title header overlay
    const title = page.title || `Seite ${i + 1}`;
    drawTitleOnPdf(pdf, title, i + 1, totalPages);
  }

  // Trigger download
  const filename = `${workspaceName.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_ ]/g, "").trim() || "workspace"}.pdf`;
  pdf.save(filename);
}
