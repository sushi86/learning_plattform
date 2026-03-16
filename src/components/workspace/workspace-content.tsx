"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type Konva from "konva";
import { WhiteboardCanvas } from "@/components/whiteboard";
import type { BackgroundType } from "@/components/whiteboard/types";
import { A4_WIDTH_PX, A4_HEIGHT_PX } from "@/components/whiteboard/types";
import { exportWorkspaceToPdf } from "@/lib/pdf-export";
import type { ConnectionStatus } from "@/lib/useYjsSync";
import NewPageDialog from "./new-page-dialog";
import PdfExportDialog from "./pdf-export-dialog";
import ConnectionStatusIndicator from "./connection-status";
import MemberManagement from "./member-management";
import type { PageItem, WorkspaceInfo } from "./types";

interface WorkspaceContentProps {
  workspaceId: string;
}

export default function WorkspaceContent({
  workspaceId,
}: WorkspaceContentProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewPageDialog, setShowNewPageDialog] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("offline");
  const [showMembers, setShowMembers] = useState(false);

  // PDF export state
  const stageRef = useRef<Konva.Stage | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Set first page as active for connection status tracking


  const isTeacher = session?.user?.role === "TEACHER";
  const activePage = pages.find((p) => p.id === activePageId) || null;

  // Fetch workspace info
  const fetchWorkspace = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setWorkspace(data);
      }
    } catch {
      // Silently fail
    }
  }, [workspaceId]);

  // Fetch pages
  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/pages`);
      if (res.ok) {
        const data: PageItem[] = await res.json();
        setPages(data);

        // If no active page set, select the first one
        if (data.length > 0 && !activePageId) {
          setActivePageId(data[0].id);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [workspaceId, activePageId]);

  useEffect(() => {
    fetchWorkspace();
    fetchPages();
  }, [fetchWorkspace, fetchPages]);

  // Handle page creation
  const handlePageCreated = useCallback(
    (page: { id: string; title: string | null; backgroundType: BackgroundType }) => {
      fetchPages().then(() => {
        setActivePageId(page.id);
      });
    },
    [fetchPages],
  );

  // Handle page deletion
  const handleDeletePage = useCallback(
    async (pageId: string) => {
      if (!confirm("Seite wirklich löschen?")) return;

      try {
        const res = await fetch(`/api/pages/${pageId}`, {
          method: "DELETE",
        });

        if (res.ok) {
          setPages((prev) => {
            const updated = prev.filter((p) => p.id !== pageId);
            // If the deleted page was active, select the first remaining
            if (activePageId === pageId && updated.length > 0) {
              setActivePageId(updated[0].id);
            } else if (updated.length === 0) {
              setActivePageId(null);
            }
            return updated;
          });
        }
      } catch {
        // Silently fail
      }
    },
    [activePageId],
  );

  const handleStageMount = useCallback((stage: Konva.Stage) => {
    stageRef.current = stage;
  }, []);

  // Handle PDF export
  const handlePdfExport = useCallback(async () => {
    if (pages.length === 0 || pdfExporting) return;

    setPdfExporting(true);
    setPdfProgress({ current: 0, total: pages.length });
    setPdfError(null);

    try {
      await exportWorkspaceToPdf({
        pages,
        workspaceName: workspace?.name || "Workspace",
        activePageId,
        getStageImage: async () => {
          const stage = stageRef.current;
          if (!stage) return null;
          // Temporarily reset transform to capture raw A4 area
          const prevScale = { x: stage.scaleX(), y: stage.scaleY() };
          const prevPos = { x: stage.x(), y: stage.y() };
          stage.scaleX(1);
          stage.scaleY(1);
          stage.x(0);
          stage.y(0);

          const dataUrl = stage.toDataURL({
            x: 0,
            y: 0,
            width: A4_WIDTH_PX,
            height: A4_HEIGHT_PX,
            pixelRatio: 3,
          });

          stage.scaleX(prevScale.x);
          stage.scaleY(prevScale.y);
          stage.x(prevPos.x);
          stage.y(prevPos.y);
          return dataUrl;
        },
        onProgress: (current, total) => {
          setPdfProgress({ current, total });
        },
      });

      // Keep dialog open briefly to show completion
      setTimeout(() => {
        setPdfExporting(false);
        setPdfProgress({ current: 0, total: 0 });
      }, 1500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler beim Export.";
      setPdfError(message);
    }
  }, [pages, workspace?.name, activePageId, pdfExporting]);

  const handlePdfDialogClose = useCallback(() => {
    setPdfExporting(false);
    setPdfProgress({ current: 0, total: 0 });
    setPdfError(null);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-violet-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            title="Zurück zum Dashboard"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
          </button>

          {/* Workspace name */}
          <h1 className="font-[family-name:var(--font-caveat)] text-xl font-bold text-gray-900">
            {workspace?.name || "Workspace"}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection status */}
          <ConnectionStatusIndicator status={connectionStatus} />

          {/* PDF export */}
          <button
            onClick={handlePdfExport}
            disabled={pages.length === 0 || pdfExporting}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="Als PDF exportieren"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Members / Settings */}
          <button
            onClick={() => setShowMembers(true)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
            title="Mitglieder verwalten"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Scrollable page stack */}
      <main className="flex-1 overflow-y-auto bg-gray-100">
        {pages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="mb-2 text-lg font-medium text-gray-400">
                Keine Seiten vorhanden
              </p>
              <button
                onClick={() => setShowNewPageDialog(true)}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
              >
                Erste Seite erstellen
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
            {pages.map((page, index) => (
              <section key={page.id} className="flex flex-col">
                {/* Page header */}
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    {page.title || `Seite ${index + 1}`}
                  </span>
                  {isTeacher && pages.length > 1 && (
                    <button
                      onClick={() => handleDeletePage(page.id)}
                      className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Seite löschen"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
                {/* Canvas — aspect ratio matches A4 (794×1123) */}
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm" style={{ aspectRatio: `${A4_WIDTH_PX} / ${A4_HEIGHT_PX}` }}>
                  <WhiteboardCanvas
                    key={page.id}
                    pageId={page.id}
                    backgroundType={page.backgroundType}
                    onMount={activePageId === page.id ? handleStageMount : undefined}
                    onConnectionStatusChange={activePageId === page.id ? setConnectionStatus : undefined}
                    aiEnabled={session?.user?.aiEnabled ?? false}
                    className="h-full w-full"
                  />
                </div>
              </section>
            ))}

            {/* Add page button */}
            <button
              onClick={() => setShowNewPageDialog(true)}
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-8 text-sm font-medium text-gray-400 transition-colors hover:border-violet-400 hover:text-violet-500"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Neue Seite
            </button>
          </div>
        )}
      </main>

      {/* New page dialog */}
      <NewPageDialog
        open={showNewPageDialog}
        onClose={() => setShowNewPageDialog(false)}
        onCreated={handlePageCreated}
        workspaceId={workspaceId}
      />

      {/* Member management dialog */}
      <MemberManagement
        workspaceId={workspaceId}
        isTeacher={isTeacher}
        open={showMembers}
        onClose={() => setShowMembers(false)}
      />

      {/* PDF export progress dialog */}
      <PdfExportDialog
        open={pdfExporting}
        currentPage={pdfProgress.current}
        totalPages={pdfProgress.total}
        error={pdfError}
        onClose={handlePdfDialogClose}
      />
    </div>
  );
}
