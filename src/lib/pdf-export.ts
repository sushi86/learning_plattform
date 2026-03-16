import { jsPDF } from "jspdf";
import type { BackgroundType } from "@/components/whiteboard/types";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export interface PdfPageData {
  id: string;
  title: string | null;
  backgroundType: BackgroundType;
  sortOrder: number;
}

export interface PdfExportOptions {
  pages: PdfPageData[];
  workspaceName: string;
  getStageImage?: () => Promise<string | null>;
  activePageId?: string | null;
  onProgress?: (current: number, total: number) => void;
}

function drawTitleOnPdf(pdf: jsPDF, title: string, pageNumber: number, totalPages: number) {
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(title, 10, 8);
  pdf.text(`${pageNumber} / ${totalPages}`, A4_WIDTH_MM - 10, 8, { align: "right" });
}

export async function exportWorkspaceToPdf({
  pages,
  workspaceName,
  getStageImage,
  activePageId,
  onProgress,
}: PdfExportOptions): Promise<void> {
  if (pages.length === 0) throw new Error("Keine Seiten zum Exportieren vorhanden.");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const totalPages = pages.length;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    onProgress?.(i + 1, totalPages);

    if (i > 0) pdf.addPage("a4", "portrait");

    if (page.id === activePageId && getStageImage) {
      try {
        const dataUrl = await getStageImage();
        if (dataUrl) {
          pdf.addImage(dataUrl, "PNG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
        }
      } catch {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, "F");
      }
    } else {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, "F");
    }

    const title = page.title || `Seite ${i + 1}`;
    drawTitleOnPdf(pdf, title, i + 1, totalPages);
  }

  const filename = `${workspaceName.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_ ]/g, "").trim() || "workspace"}.pdf`;
  pdf.save(filename);
}
