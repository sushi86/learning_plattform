"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { WhiteboardCanvas } from "@/components/whiteboard";
import type { BackgroundType } from "@/components/whiteboard/types";
import type { ConnectionStatus } from "@/lib/useYjsSync";
import PageSidebar from "./page-sidebar";
import NewPageDialog from "./new-page-dialog";
import ConnectionStatusIndicator from "./connection-status";
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

  // Handle page reorder
  const handleReorder = useCallback(
    async (updates: { id: string; sortOrder: number }[]) => {
      // Optimistic update: reorder locally first
      setPages((prev) => {
        const updated = prev.map((page) => {
          const update = updates.find((u) => u.id === page.id);
          return update ? { ...page, sortOrder: update.sortOrder } : page;
        });
        return updated.sort((a, b) => a.sortOrder - b.sortOrder);
      });

      // Persist to server
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/pages/reorder`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pages: updates }),
          },
        );

        if (res.ok) {
          const serverPages: PageItem[] = await res.json();
          setPages(serverPages);
        }
      } catch {
        // Revert on failure by re-fetching
        fetchPages();
      }
    },
    [workspaceId, fetchPages],
  );

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

          {/* PDF export placeholder */}
          <button
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
            title="PDF Export (coming soon)"
            disabled
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
          </button>

          {/* Settings placeholder */}
          <button
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
            title="Einstellungen (coming soon)"
            disabled
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

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <PageSidebar
          pages={pages}
          activePageId={activePageId}
          onSelectPage={setActivePageId}
          onAddPage={() => setShowNewPageDialog(true)}
          onDeletePage={handleDeletePage}
          onReorder={handleReorder}
          isTeacher={isTeacher}
        />

        {/* Canvas area */}
        <main className="flex-1">
          {activePage ? (
            <WhiteboardCanvas
              key={activePage.id}
              pageId={activePage.id}
              backgroundType={activePage.backgroundType}
              onConnectionStatusChange={setConnectionStatus}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="mb-2 text-lg font-medium text-gray-400">
                  Keine Seite ausgewählt
                </p>
                <button
                  onClick={() => setShowNewPageDialog(true)}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
                >
                  Erste Seite erstellen
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* New page dialog */}
      <NewPageDialog
        open={showNewPageDialog}
        onClose={() => setShowNewPageDialog(false)}
        onCreated={handlePageCreated}
        workspaceId={workspaceId}
      />
    </div>
  );
}
