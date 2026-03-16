"use client";

import { type ToolType, COLORS, STROKE_WIDTHS } from "./types";

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  activeColor: string;
  onColorChange: (color: string) => void;
  activeStrokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  children?: React.ReactNode;
}

const TOOL_ITEMS: { tool: ToolType; label: string; icon: string }[] = [
  { tool: "select", label: "Auswählen", icon: "↖" },
  { tool: "draw", label: "Stift", icon: "✏" },
  { tool: "eraser", label: "Radierer", icon: "⌫" },
  { tool: "text", label: "Text", icon: "T" },
  { tool: "line", label: "Linie", icon: "╱" },
];

export function Toolbar({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  activeStrokeWidth,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  children,
}: ToolbarProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-xl bg-white px-2 py-1.5 shadow-lg border border-gray-200">
      {/* Undo/Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700"
        title="Rückgängig (Strg+Z)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" /><path d="M3 13a9 9 0 0 1 15.36-6.36L21 9" />
        </svg>
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700"
        title="Wiederholen (Strg+Shift+Z)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 7v6h-6" /><path d="M21 13a9 9 0 0 0-15.36-6.36L3 9" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Tools */}
      {TOOL_ITEMS.map(({ tool, label, icon }) => (
        <button
          key={tool}
          onClick={() => onToolChange(tool)}
          className={`flex items-center justify-center w-9 h-9 rounded-lg text-sm transition-colors ${
            activeTool === tool
              ? "bg-blue-100 text-blue-700"
              : "hover:bg-gray-100 text-gray-700"
          }`}
          title={label}
        >
          {icon}
        </button>
      ))}

      {/* File upload slot */}
      {children}

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Colors */}
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onColorChange(color)}
          className={`w-6 h-6 rounded-full border-2 transition-transform ${
            activeColor === color ? "border-blue-500 scale-110" : "border-gray-300"
          }`}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Stroke widths */}
      {STROKE_WIDTHS.map((w) => (
        <button
          key={w}
          onClick={() => onStrokeWidthChange(w)}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
            activeStrokeWidth === w ? "bg-blue-100" : "hover:bg-gray-100"
          }`}
          title={`Strichstärke ${w}px`}
        >
          <div
            className="rounded-full bg-gray-800"
            style={{ width: w + 2, height: w + 2 }}
          />
        </button>
      ))}
    </div>
  );
}
