"use client";

import { useState, useEffect } from "react";

interface InviteLink {
  id: string;
  token: string;
  expiresAt: string | null;
  createdAt: string;
}

interface InviteLinkDialogProps {
  open: boolean;
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}

export default function InviteLinkDialog({
  open,
  workspaceId,
  workspaceName,
  onClose,
}: InviteLinkDialogProps) {
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setNewUrl("");
      setError("");
      setCopied(null);
      fetchInviteLinks();
    }
  }, [open, workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchInviteLinks() {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`);
      if (res.ok) {
        const data = await res.json();
        setInviteLinks(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    setNewUrl("");

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Fehler beim Generieren.");
        return;
      }

      setNewUrl(getInviteUrl(data.token));
      // Refresh the list
      fetchInviteLinks();
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  function getInviteUrl(token: string) {
    return `${window.location.origin}/invite/${token}`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function isExpired(expiresAt: string | null) {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 font-[family-name:var(--font-caveat)] text-3xl font-bold text-gray-900">
          Einladungslinks
        </h2>
        <p className="mb-4 text-sm text-gray-500">{workspaceName}</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Generate new link */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Generiere...
            </>
          ) : (
            <>
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
                  d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                />
              </svg>
              Neuen Einladungslink erstellen
            </>
          )}
        </button>

        {/* Newly generated link */}
        {newUrl && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="mb-2 text-xs font-medium text-green-700">
              Neuer Link erstellt:
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={newUrl}
                className="flex-1 rounded border border-green-300 bg-white px-2 py-1.5 text-xs text-gray-700"
              />
              <button
                onClick={() => copyToClipboard(newUrl, "new")}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
              >
                {copied === "new" ? "Kopiert!" : "Kopieren"}
              </button>
            </div>
          </div>
        )}

        {/* Existing links list */}
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-violet-600" />
            </div>
          ) : inviteLinks.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Keine offenen Einladungslinks vorhanden.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">
                Offene Einladungslinks ({inviteLinks.length})
              </p>
              {inviteLinks.map((link) => {
                const expired = isExpired(link.expiresAt);
                const url = getInviteUrl(link.token);
                return (
                  <div
                    key={link.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      expired
                        ? "border-gray-200 bg-gray-50 opacity-60"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-gray-600">
                        {link.token.slice(0, 16)}...
                      </p>
                      <p className="text-xs text-gray-400">
                        Erstellt: {formatDate(link.createdAt)}
                        {link.expiresAt && (
                          <>
                            {" · "}
                            {expired ? (
                              <span className="text-red-500">Abgelaufen</span>
                            ) : (
                              <>Gültig bis: {formatDate(link.expiresAt)}</>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    {!expired && (
                      <button
                        onClick={() => copyToClipboard(url, link.id)}
                        className="ml-2 shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        {copied === link.id ? "Kopiert!" : "Kopieren"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
