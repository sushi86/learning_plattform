"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import WorkspaceCard from "./workspace-card";
import CreateWorkspaceDialog from "./create-workspace-dialog";
import DeleteWorkspaceDialog from "./delete-workspace-dialog";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  _count: {
    members: number;
    pages: number;
  };
}

export default function DashboardContent() {
  const { data: session } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const isTeacher = session?.user?.role === "TEACHER";

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
      }
    } catch {
      // Network error — silently fail, user can refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const roleBadge = isTeacher ? (
    <span className="rounded-full bg-violet-100 px-3 py-0.5 text-xs font-medium text-violet-700">
      Lehrer
    </span>
  ) : (
    <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-medium text-blue-700">
      Schüler
    </span>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <h1 className="font-[family-name:var(--font-caveat)] text-3xl font-bold text-gray-900">
              MathBoard
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-sm text-gray-600">
                {session?.user?.name}
              </span>
              {roleBadge}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-caveat)] text-2xl font-bold text-gray-900">
            {isTeacher ? "Meine Workspaces" : "Meine Workspaces"}
          </h2>
          {isTeacher && (
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Neuer Workspace
            </button>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-violet-600" />
          </div>
        )}

        {/* Empty state */}
        {!loading && workspaces.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 py-20">
            <svg
              className="mb-4 h-16 w-16 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
              />
            </svg>
            <p className="mb-2 text-lg font-medium text-gray-500">
              Noch keine Workspaces
            </p>
            <p className="text-sm text-gray-400">
              {isTeacher
                ? "Erstelle deinen ersten Workspace, um loszulegen."
                : "Dein Lehrer hat dir noch keinen Workspace zugewiesen."}
            </p>
            {isTeacher && (
              <button
                onClick={() => setShowCreateDialog(true)}
                className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
              >
                Workspace erstellen
              </button>
            )}
          </div>
        )}

        {/* Workspace grid */}
        {!loading && workspaces.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                id={ws.id}
                name={ws.name}
                description={ws.description}
                memberCount={ws._count.members}
                pageCount={ws._count.pages}
                isTeacher={isTeacher}
                onDelete={(id) =>
                  setDeleteTarget({ id, name: ws.name })
                }
              />
            ))}

            {/* New workspace card (teacher only) */}
            {isTeacher && (
              <button
                onClick={() => setShowCreateDialog(true)}
                className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white transition-all hover:border-violet-400 hover:bg-violet-50/50"
              >
                <svg
                  className="mb-2 h-10 w-10 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-500">
                  Neuer Workspace
                </span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* Dialogs */}
      <CreateWorkspaceDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={fetchWorkspaces}
      />

      {deleteTarget && (
        <DeleteWorkspaceDialog
          open={true}
          workspaceId={deleteTarget.id}
          workspaceName={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onDeleted={fetchWorkspaces}
        />
      )}
    </div>
  );
}
