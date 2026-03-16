"use client";

import type { AiSelection } from "./tools/useRectSelect";

interface AiButtonsProps {
  selection: AiSelection;
  aiEnabled: boolean;
  loading: boolean;
  onSolve: () => void;
  onCheck: () => void;
  onCancel: () => void;
  scale: number;
  stageX: number;
  stageY: number;
}

export function AiButtons({
  selection,
  aiEnabled,
  loading,
  onSolve,
  onCheck,
  onCancel,
  scale,
  stageX,
  stageY,
}: AiButtonsProps) {
  if (!aiEnabled) return null;

  const { bounds } = selection;
  const screenX = bounds.x * scale + stageX;
  const screenY = (bounds.y + bounds.height) * scale + stageY + 8;

  if (loading) {
    return (
      <div
        className="absolute z-30 flex items-center gap-2 rounded-lg bg-violet-100 px-4 py-2 shadow-lg border border-violet-200"
        style={{ left: screenX, top: screenY }}
      >
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
        <span className="animate-pulse text-sm font-medium text-violet-700">
          KI denkt nach...
        </span>
      </div>
    );
  }

  return (
    <div
      className="absolute z-30 flex items-center gap-2"
      style={{ left: screenX, top: screenY }}
    >
      <button
        onClick={onSolve}
        className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-violet-700"
      >
        KI Lösung
      </button>
      <button
        onClick={onCheck}
        className="rounded-lg border-2 border-violet-600 bg-white px-3 py-1.5 text-sm font-medium text-violet-600 shadow-md transition-colors hover:bg-violet-50"
      >
        KI Hilfe
      </button>
      <button
        onClick={onCancel}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 shadow-md transition-colors hover:bg-gray-100 hover:text-gray-700"
        title="Abbrechen"
      >
        ✕
      </button>
    </div>
  );
}
