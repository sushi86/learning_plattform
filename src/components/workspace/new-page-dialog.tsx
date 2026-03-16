"use client";

import { useState } from "react";
import type { BackgroundType } from "@/components/whiteboard/types";

interface NewPageDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (page: {
    id: string;
    title: string | null;
    backgroundType: BackgroundType;
  }) => void;
  workspaceId: string;
}

const BACKGROUND_OPTIONS: {
  type: BackgroundType;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    type: "BLANK",
    label: "Leer",
    icon: (
      <div className="h-full w-full rounded border border-gray-200 bg-white" />
    ),
  },
  {
    type: "GRID",
    label: "Kariert",
    icon: (
      <div className="relative h-full w-full overflow-hidden rounded border border-gray-200 bg-white">
        {/* Grid lines */}
        <svg className="absolute inset-0 h-full w-full">
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={((i + 1) * 100) / 8 + "%"}
              y1="0"
              x2={((i + 1) * 100) / 8 + "%"}
              y2="100%"
              stroke="#ddd"
              strokeWidth="0.5"
            />
          ))}
          {Array.from({ length: 10 }, (_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={((i + 1) * 100) / 10 + "%"}
              x2="100%"
              y2={((i + 1) * 100) / 10 + "%"}
              stroke="#ddd"
              strokeWidth="0.5"
            />
          ))}
        </svg>
      </div>
    ),
  },
  {
    type: "LINED",
    label: "Liniert",
    icon: (
      <div className="relative h-full w-full overflow-hidden rounded border border-gray-200 bg-white">
        <svg className="absolute inset-0 h-full w-full">
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={((i + 1) * 100) / 9 + "%"}
              x2="100%"
              y2={((i + 1) * 100) / 9 + "%"}
              stroke="#c8d4e0"
              strokeWidth="0.5"
            />
          ))}
        </svg>
      </div>
    ),
  },
  {
    type: "COORDINATE",
    label: "Koordinaten",
    icon: (
      <div className="relative h-full w-full overflow-hidden rounded border border-gray-200 bg-white">
        <svg className="absolute inset-0 h-full w-full">
          {/* Grid */}
          {Array.from({ length: 6 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={((i + 1) * 100) / 7 + "%"}
              y1="0"
              x2={((i + 1) * 100) / 7 + "%"}
              y2="100%"
              stroke="#eee"
              strokeWidth="0.5"
            />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={((i + 1) * 100) / 9 + "%"}
              x2="100%"
              y2={((i + 1) * 100) / 9 + "%"}
              stroke="#eee"
              strokeWidth="0.5"
            />
          ))}
          {/* Axes */}
          <line
            x1="50%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke="#333"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1="50%"
            x2="100%"
            y2="50%"
            stroke="#333"
            strokeWidth="1"
          />
        </svg>
      </div>
    ),
  },
];

export default function NewPageDialog({
  open,
  onClose,
  onCreated,
  workspaceId,
}: NewPageDialogProps) {
  const [title, setTitle] = useState("");
  const [backgroundType, setBackgroundType] = useState<BackgroundType>("BLANK");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          backgroundType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler beim Erstellen der Seite");
        return;
      }

      const page = await res.json();
      onCreated(page);
      // Reset state
      setTitle("");
      setBackgroundType("BLANK");
      onClose();
    } catch {
      setError("Netzwerkfehler — bitte versuche es erneut");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 font-[family-name:var(--font-caveat)] text-2xl font-bold text-gray-900">
          Neue Seite
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Title input */}
          <div className="mb-4">
            <label
              htmlFor="page-title"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Titel (optional)
            </label>
            <input
              id="page-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Sinussatz"
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {/* Background type selection */}
          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Hintergrund
            </label>
            <div className="grid grid-cols-4 gap-3">
              {BACKGROUND_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setBackgroundType(option.type)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all ${
                    backgroundType === option.type
                      ? "border-violet-500 bg-violet-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="aspect-[3/4] w-full">{option.icon}</div>
                  <span className="text-xs font-medium text-gray-600">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="mb-3 text-sm text-red-600">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              disabled={loading}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Erstelle..." : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
