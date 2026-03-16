"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AiExplainInputProps {
  screenX: number;
  screenY: number;
  loading: boolean;
  onSubmit: (question: string) => void;
  onCancel: () => void;
}

export function AiExplainInput({
  screenX,
  screenY,
  loading,
  onSubmit,
  onCancel,
}: AiExplainInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && value.trim()) {
        e.preventDefault();
        onSubmit(value.trim());
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [value, onSubmit, onCancel],
  );

  return (
    <div
      className="absolute z-30 flex items-center gap-2 rounded-lg bg-white p-2 shadow-lg border border-violet-200"
      style={{ left: screenX, top: screenY }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Frage stellen..."
        disabled={loading}
        className="w-60 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
      />
      {loading ? (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
      ) : (
        <>
          <button
            onClick={() => value.trim() && onSubmit(value.trim())}
            disabled={!value.trim()}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            Fragen
          </button>
          <button
            onClick={onCancel}
            className="rounded-md px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
