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

/* SVG icon components for toolbar */
const PencilIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
  </svg>
);

const CursorIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3l14 8-7 2-3 7z" />
  </svg>
);

const EraserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </svg>
);

const TextIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);

const LineIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="5" y1="19" x2="19" y2="5" />
  </svg>
);

const TOOL_ITEMS: { tool: ToolType; label: string; icon: React.ComponentType }[] = [
  { tool: "draw", label: "Stift", icon: PencilIcon },
  { tool: "select", label: "Auswählen", icon: CursorIcon },
  { tool: "eraser", label: "Radierer", icon: EraserIcon },
  { tool: "text", label: "Text", icon: TextIcon },
  { tool: "line", label: "Linie", icon: LineIcon },
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
        className="flex items-center justify-center w-9 h-9 rounded-lg text-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700"
        title="Rückgängig (Strg+Z)"
      >
        ↩
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700"
        title="Wiederholen (Strg+Shift+Z)"
      >
        ↪
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Tools */}
      {TOOL_ITEMS.map(({ tool, label, icon: Icon }) => (
        <button
          key={tool}
          onClick={() => onToolChange(tool)}
          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
            activeTool === tool
              ? "bg-blue-100 text-blue-700"
              : "hover:bg-gray-100 text-gray-700"
          }`}
          title={label}
        >
          <Icon />
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
