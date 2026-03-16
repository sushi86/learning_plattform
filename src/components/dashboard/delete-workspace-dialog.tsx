"use client";

import { useState } from "react";

interface DeleteWorkspaceDialogProps {
  open: boolean;
  workspaceName: string;
  workspaceId: string;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteWorkspaceDialog({
  open,
  workspaceName,
  workspaceId,
  onClose,
  onDeleted,
}: DeleteWorkspaceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleDelete() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Löschen.");
        return;
      }

      onDeleted();
      onClose();
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Workspace löschen?
        </h2>

        <p className="mb-4 text-sm text-gray-600">
          Bist du sicher, dass du{" "}
          <span className="font-semibold text-gray-900">
            &ldquo;{workspaceName}&rdquo;
          </span>{" "}
          löschen möchtest? Alle Seiten, Zeichnungen und Dateien werden
          unwiderruflich gelöscht.
        </p>

        {error && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Lösche..." : "Endgültig löschen"}
          </button>
        </div>
      </div>
    </div>
  );
}
