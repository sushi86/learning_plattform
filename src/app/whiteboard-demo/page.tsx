"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { BackgroundType } from "@/components/whiteboard";

// Dynamic import to avoid SSR issues with Konva
const WhiteboardCanvas = dynamic(
  () =>
    import("@/components/whiteboard").then((mod) => mod.WhiteboardCanvas),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full">Lade Whiteboard...</div> },
);

const BACKGROUND_OPTIONS: { value: BackgroundType; label: string }[] = [
  { value: "BLANK", label: "Leer" },
  { value: "GRID", label: "Kariert" },
  { value: "LINED", label: "Liniert" },
  { value: "COORDINATE", label: "Koordinatensystem" },
];

export default function WhiteboardDemoPage() {
  const [backgroundType, setBackgroundType] = useState<BackgroundType>("GRID");

  return (
    <div className="flex flex-col h-screen">
      {/* Background type selector */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <span className="text-sm font-medium text-gray-700">Hintergrund:</span>
        {BACKGROUND_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setBackgroundType(option.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              backgroundType === option.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0">
        <WhiteboardCanvas
          key={backgroundType}
          backgroundType={backgroundType}
        />
      </div>
    </div>
  );
}
