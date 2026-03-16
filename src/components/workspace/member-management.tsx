"use client";

import { useState, useEffect, useCallback } from "react";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface Owner {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface MemberManagementProps {
  workspaceId: string;
  isTeacher: boolean;
  open: boolean;
  onClose: () => void;
}

export default function MemberManagement({
  workspaceId,
  isTeacher,
  open,
  onClose,
}: MemberManagementProps) {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/workspaces/${workspaceId}/members`);
      if (res.ok) {
        const data = await res.json();
        setOwner(data.owner);
        setMembers(data.members);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, fetchMembers]);

  const handleRemove = async (userId: string, userName: string) => {
    if (!confirm(`${userName} wirklich aus dem Workspace entfernen?`)) return;

    setRemoving(userId);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members/${userId}`,
        { method: "DELETE" },
      );

      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== userId));
      } else {
        const data = await res.json();
        alert(data.error || "Fehler beim Entfernen");
      }
    } catch {
      alert("Fehler beim Entfernen des Mitglieds");
    } finally {
      setRemoving(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="font-[family-name:var(--font-caveat)] text-xl font-bold text-gray-900">
            Mitglieder
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
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
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-violet-600" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Owner */}
              {owner && (
                <div className="flex items-center justify-between rounded-lg bg-violet-50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-200 text-sm font-medium text-violet-700">
                      {owner.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {owner.name}
                      </p>
                      <p className="text-xs text-gray-500">{owner.email}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-violet-200 px-2 py-0.5 text-xs font-medium text-violet-700">
                    Lehrer
                  </span>
                </div>
              )}

              {/* Members */}
              {members.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">
                  Noch keine Schüler in diesem Workspace
                </p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {member.name}
                        </p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {new Date(member.joinedAt).toLocaleDateString("de-DE")}
                      </span>
                      {isTeacher && (
                        <button
                          onClick={() => handleRemove(member.id, member.name)}
                          disabled={removing === member.id}
                          className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Mitglied entfernen"
                        >
                          {removing === member.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-500" />
                          ) : (
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
                                d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
                              />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3">
          <p className="text-xs text-gray-400">
            {members.length}{" "}
            {members.length === 1 ? "Schüler" : "Schüler"} im Workspace
          </p>
        </div>
      </div>
    </div>
  );
}
