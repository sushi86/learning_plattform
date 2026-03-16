# Replace tldraw with Konva.js — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the commercial tldraw SDK with open-source Konva.js for the whiteboard drawing engine, making the A4 sheet zoom/pan with content.

**Architecture:** Konva Stage renders a fixed A4 sheet (794x1123px) with background pattern, content shapes, and tool overlay as three layers. Y.js syncs shapes via `Y.Map<Shape>`. Tools (select, draw, eraser, text, line) are implemented as pointer event handlers on the stage.

**Tech Stack:** Konva.js, react-konva, Y.js, Y.UndoManager, y-indexeddb, jsPDF

**Spec:** `docs/superpowers/specs/2026-03-16-replace-tldraw-with-konva-design.md`

**Deferred to follow-up:**
- **Live drawing sync** (Y.Array deltas during active drawing) — initial version syncs on pointerup only. Live preview requires Y.Array-per-shape which adds complexity. Can be added without breaking changes.
- **Pinch-to-zoom** on iPad — initial version supports mousewheel zoom only. Touch gesture handling requires multi-touch tracking. Can be added via Konva's built-in touch events.

---

## File Structure

### New files
- `src/components/whiteboard/types.ts` — Shape type definitions (rewrite existing)
- `src/components/whiteboard/WhiteboardCanvas.tsx` — Main Konva Stage component (rewrite existing)
- `src/components/whiteboard/tools/useDraw.ts` — Freehand drawing tool hook
- `src/components/whiteboard/tools/useLine.ts` — Straight line tool hook
- `src/components/whiteboard/tools/useEraser.ts` — Eraser tool hook
- `src/components/whiteboard/tools/useText.ts` — Text tool hook
- `src/components/whiteboard/tools/useSelect.ts` — Select/move/resize tool hook
- `src/components/whiteboard/tools/index.ts` — Tool exports
- `src/components/whiteboard/Toolbar.tsx` — Custom toolbar component
- `src/components/whiteboard/backgrounds/KonvaGrid.tsx` — Grid background as Konva Group
- `src/components/whiteboard/backgrounds/KonvaLined.tsx` — Lined background as Konva Group
- `src/components/whiteboard/backgrounds/KonvaCoordinate.tsx` — Coordinate background as Konva Group
- `src/components/whiteboard/backgrounds/KonvaBlank.tsx` — Blank background as Konva Group
- `src/components/whiteboard/useZoomPan.ts` — Zoom/pan hook with wheel + pinch + Space+drag
- `src/lib/useYjsSync.ts` — Y.js sync hook (rewrite existing)

### Modified files
- `src/components/whiteboard/index.ts` — Update exports
- `src/components/whiteboard/backgrounds/index.ts` — Update exports
- `src/components/whiteboard/FileUploadButton.tsx` — Remove tldraw deps
- `src/components/workspace/workspace-content.tsx` — Remove tldraw Editor type, use Konva stage ref
- `src/lib/pdf-export.ts` — Use stage.toDataURL() instead of tldraw SVG
- `src/app/whiteboard-demo/page.tsx` — Update for new component API
- `package.json` — Swap deps

### Deleted files
- `src/components/whiteboard/backgrounds/BlankBackground.tsx`
- `src/components/whiteboard/backgrounds/GridBackground.tsx`
- `src/components/whiteboard/backgrounds/LinedBackground.tsx`
- `src/components/whiteboard/backgrounds/CoordinateBackground.tsx`

---

## Chunk 1: Foundation (deps, types, backgrounds, stage shell)

### Task 1: Swap dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove tldraw, add konva + react-konva**

```bash
npm uninstall tldraw
npm install konva react-konva
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('konva'); require('react-konva'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: replace tldraw with konva + react-konva"
```

---

### Task 2: Shape types and constants

**Files:**
- Rewrite: `src/components/whiteboard/types.ts`

- [ ] **Step 1: Write the shape type definitions**

Replace the entire file with:

```ts
/**
 * A4 page dimensions in pixels (at 96 DPI).
 * 210mm x 297mm → 794px x 1123px
 */
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

/** Millimeters to pixels conversion factor at 96 DPI */
export const MM_TO_PX = 96 / 25.4; // ~3.78 px per mm

/** Grid spacing: 5mm in pixels */
export const GRID_SPACING_PX = 5 * MM_TO_PX;

/** Lined spacing: 8mm in pixels */
export const LINE_SPACING_PX = 8 * MM_TO_PX;

/** Coordinate system grid spacing: 10mm in pixels */
export const COORD_GRID_SPACING_PX = 10 * MM_TO_PX;

/** Background types for the whiteboard canvas pages */
export type BackgroundType = "BLANK" | "GRID" | "LINED" | "COORDINATE";

/** Available tool types */
export type ToolType = "select" | "draw" | "eraser" | "text" | "line";

/** Color palette */
export const COLORS = [
  "#18181b", // black
  "#dc2626", // red
  "#2563eb", // blue
  "#16a34a", // green
  "#ea580c", // orange
  "#9333ea", // purple
] as const;

/** Stroke width options */
export const STROKE_WIDTHS = [2, 4, 8] as const;

/** Shape type discriminator */
export type ShapeType = "draw" | "line" | "text" | "image";

interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  color: string;
}

export interface DrawShape extends BaseShape {
  type: "draw";
  props: {
    points: number[];       // flat [x1,y1,x2,y2,...] relative to x,y
    pressures?: number[];   // pressure per point (0-1), length = points.length/2
    strokeWidth: number;
  };
}

export interface LineShape extends BaseShape {
  type: "line";
  props: {
    points: [number, number, number, number]; // [x1,y1,x2,y2] relative to x,y
    strokeWidth: number;
  };
}

export interface TextShape extends BaseShape {
  type: "text";
  props: {
    content: string;
    fontSize: number;
    width?: number;   // text area width for wrapping
  };
}

export interface ImageShape extends BaseShape {
  type: "image";
  props: {
    src: string;
    width: number;
    height: number;
  };
}

export type Shape = DrawShape | LineShape | TextShape | ImageShape;

/** Clamp a point to A4 sheet bounds */
export function clampToSheet(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(A4_WIDTH_PX, x)),
    y: Math.max(0, Math.min(A4_HEIGHT_PX, y)),
  };
}

/** Check if a point is within A4 sheet bounds */
export function isInSheet(x: number, y: number): boolean {
  return x >= 0 && x <= A4_WIDTH_PX && y >= 0 && y <= A4_HEIGHT_PX;
}

/** Generate a unique shape ID */
export function createShapeId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/whiteboard/types.ts
git commit -m "feat: add Shape type definitions and constants for Konva canvas"
```

---

### Task 3: Konva background components

**Files:**
- Create: `src/components/whiteboard/backgrounds/KonvaBlank.tsx`
- Create: `src/components/whiteboard/backgrounds/KonvaGrid.tsx`
- Create: `src/components/whiteboard/backgrounds/KonvaLined.tsx`
- Create: `src/components/whiteboard/backgrounds/KonvaCoordinate.tsx`
- Rewrite: `src/components/whiteboard/backgrounds/index.ts`
- Delete: `src/components/whiteboard/backgrounds/BlankBackground.tsx`
- Delete: `src/components/whiteboard/backgrounds/GridBackground.tsx`
- Delete: `src/components/whiteboard/backgrounds/LinedBackground.tsx`
- Delete: `src/components/whiteboard/backgrounds/CoordinateBackground.tsx`

- [ ] **Step 1: Create KonvaBlank.tsx**

```tsx
import { Rect } from "react-konva";
import { A4_WIDTH_PX, A4_HEIGHT_PX } from "../types";

export function KonvaBlank() {
  return (
    <Rect
      x={0}
      y={0}
      width={A4_WIDTH_PX}
      height={A4_HEIGHT_PX}
      fill="#ffffff"
      listening={false}
    />
  );
}
```

- [ ] **Step 2: Create KonvaGrid.tsx**

```tsx
import { Group, Rect, Line } from "react-konva";
import { A4_WIDTH_PX, A4_HEIGHT_PX, GRID_SPACING_PX } from "../types";
import { useMemo } from "react";

export function KonvaGrid() {
  const lines = useMemo(() => {
    const result: { points: number[]; key: string }[] = [];
    const s = GRID_SPACING_PX;

    // Vertical lines
    for (let x = s; x < A4_WIDTH_PX; x += s) {
      result.push({ points: [x, 0, x, A4_HEIGHT_PX], key: `v${x}` });
    }
    // Horizontal lines
    for (let y = s; y < A4_HEIGHT_PX; y += s) {
      result.push({ points: [0, y, A4_WIDTH_PX, y], key: `h${y}` });
    }
    return result;
  }, []);

  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={A4_WIDTH_PX} height={A4_HEIGHT_PX} fill="#ffffff" />
      {lines.map((l) => (
        <Line key={l.key} points={l.points} stroke="#d4d4d8" strokeWidth={0.5} />
      ))}
    </Group>
  );
}
```

- [ ] **Step 3: Create KonvaLined.tsx**

```tsx
import { Group, Rect, Line } from "react-konva";
import { A4_WIDTH_PX, A4_HEIGHT_PX, LINE_SPACING_PX } from "../types";
import { useMemo } from "react";

export function KonvaLined() {
  const lines = useMemo(() => {
    const result: { y: number }[] = [];
    const topMargin = 113; // ~30mm from top
    for (let y = topMargin; y < A4_HEIGHT_PX; y += LINE_SPACING_PX) {
      result.push({ y });
    }
    return result;
  }, []);

  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={A4_WIDTH_PX} height={A4_HEIGHT_PX} fill="#ffffff" />
      {lines.map((l) => (
        <Line
          key={l.y}
          points={[0, l.y, A4_WIDTH_PX, l.y]}
          stroke="#bfdbfe"
          strokeWidth={0.7}
        />
      ))}
    </Group>
  );
}
```

- [ ] **Step 4: Create KonvaCoordinate.tsx**

```tsx
import { Group, Rect, Line, Text } from "react-konva";
import { A4_WIDTH_PX, A4_HEIGHT_PX, COORD_GRID_SPACING_PX } from "../types";
import { useMemo } from "react";

export function KonvaCoordinate() {
  const spacing = COORD_GRID_SPACING_PX;
  const originX = Math.round(A4_WIDTH_PX / 2);
  const originY = Math.round(A4_HEIGHT_PX / 2);

  const { gridLines, labels } = useMemo(() => {
    const gl: { points: number[]; key: string }[] = [];
    const lb: { x: number; y: number; text: string; key: string; align: string }[] = [];

    // Vertical grid lines
    for (let x = originX % spacing; x < A4_WIDTH_PX; x += spacing) {
      gl.push({ points: [x, 0, x, A4_HEIGHT_PX], key: `v${x}` });
    }
    // Horizontal grid lines
    for (let y = originY % spacing; y < A4_HEIGHT_PX; y += spacing) {
      gl.push({ points: [0, y, A4_WIDTH_PX, y], key: `h${y}` });
    }

    // X-axis labels
    for (let x = originX + spacing; x < A4_WIDTH_PX - 20; x += spacing * 2) {
      const value = Math.round((x - originX) / spacing);
      lb.push({ x, y: originY + 16, text: `${value}`, key: `xl${value}`, align: "center" });
    }
    for (let x = originX - spacing; x > 20; x -= spacing * 2) {
      const value = Math.round((x - originX) / spacing);
      lb.push({ x, y: originY + 16, text: `${value}`, key: `xl${value}`, align: "center" });
    }

    // Y-axis labels
    for (let y = originY - spacing; y > 20; y -= spacing * 2) {
      const value = Math.round((originY - y) / spacing);
      lb.push({ x: originX - 14, y: y - 5, text: `${value}`, key: `yl${value}`, align: "right" });
    }
    for (let y = originY + spacing; y < A4_HEIGHT_PX - 20; y += spacing * 2) {
      const value = Math.round((originY - y) / spacing);
      lb.push({ x: originX - 14, y: y - 5, text: `${value}`, key: `yl${value}`, align: "right" });
    }

    return { gridLines: gl, labels: lb };
  }, [originX, originY, spacing]);

  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={A4_WIDTH_PX} height={A4_HEIGHT_PX} fill="#ffffff" />
      {/* Grid */}
      {gridLines.map((l) => (
        <Line key={l.key} points={l.points} stroke="#e4e4e7" strokeWidth={0.5} />
      ))}
      {/* X-axis */}
      <Line points={[0, originY, A4_WIDTH_PX, originY]} stroke="#18181b" strokeWidth={1.5} />
      {/* Y-axis */}
      <Line points={[originX, 0, originX, A4_HEIGHT_PX]} stroke="#18181b" strokeWidth={1.5} />
      {/* Axis labels */}
      <Text x={A4_WIDTH_PX - 20} y={originY - 20} text="x" fontSize={12} fontStyle="bold" fill="#18181b" />
      <Text x={originX + 10} y={4} text="y" fontSize={12} fontStyle="bold" fill="#18181b" />
      <Text x={originX - 14} y={originY + 6} text="0" fontSize={9} fill="#71717a" />
      {/* Numeric labels */}
      {labels.map((l) => (
        <Text key={l.key} x={l.x} y={l.y} text={l.text} fontSize={9} fill="#71717a" align={l.align} />
      ))}
    </Group>
  );
}
```

- [ ] **Step 5: Update backgrounds/index.ts**

```ts
export { KonvaBlank } from "./KonvaBlank";
export { KonvaGrid } from "./KonvaGrid";
export { KonvaLined } from "./KonvaLined";
export { KonvaCoordinate } from "./KonvaCoordinate";
```

- [ ] **Step 6: Delete old background files**

```bash
rm src/components/whiteboard/backgrounds/BlankBackground.tsx
rm src/components/whiteboard/backgrounds/GridBackground.tsx
rm src/components/whiteboard/backgrounds/LinedBackground.tsx
rm src/components/whiteboard/backgrounds/CoordinateBackground.tsx
```

- [ ] **Step 7: Commit**

```bash
git add -A src/components/whiteboard/backgrounds/
git commit -m "feat: rewrite backgrounds as Konva components"
```

---

### Task 4: Zoom/Pan hook

**Files:**
- Create: `src/components/whiteboard/useZoomPan.ts`

- [ ] **Step 1: Write zoom/pan hook**

```ts
"use client";

import { useCallback, useRef, useState } from "react";
import type Konva from "konva";

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
const ZOOM_SPEED = 1.1;

export interface ZoomPanState {
  scale: number;
  x: number;
  y: number;
}

interface UseZoomPanOptions {
  /** Container dimensions for fit-to-page calculation */
  containerWidth: number;
  containerHeight: number;
  /** A4 page dimensions */
  pageWidth: number;
  pageHeight: number;
}

export function useZoomPan({ containerWidth, containerHeight, pageWidth, pageHeight }: UseZoomPanOptions) {
  const [state, setState] = useState<ZoomPanState>(() => {
    // Fit page in container with padding
    const padding = 40;
    const scaleX = (containerWidth - padding * 2) / pageWidth;
    const scaleY = (containerHeight - padding * 2) / pageHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    return {
      scale,
      x: (containerWidth - pageWidth * scale) / 2,
      y: (containerHeight - pageHeight * scale) / 2,
    };
  });

  // Ref to avoid stale closures in event handlers
  const stateRef = useRef(state);
  stateRef.current = state;

  const isPanningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const spaceDownRef = useRef(false);

  /** Recalculate fit-to-page when container resizes */
  const fitToPage = useCallback(() => {
    const padding = 40;
    const scaleX = (containerWidth - padding * 2) / pageWidth;
    const scaleY = (containerHeight - padding * 2) / pageHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    setState({
      scale,
      x: (containerWidth - pageWidth * scale) / 2,
      y: (containerHeight - pageHeight * scale) / 2,
    });
  }, [containerWidth, containerHeight, pageWidth, pageHeight]);

  /** Handle wheel zoom */
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const s = stateRef.current;
    const oldScale = s.scale;
    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
      direction > 0 ? oldScale * ZOOM_SPEED : oldScale / ZOOM_SPEED
    ));

    // Zoom toward pointer position
    const mousePointTo = {
      x: (pointer.x - s.x) / oldScale,
      y: (pointer.y - s.y) / oldScale,
    };

    setState({
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, []); // stable ref — no deps needed

  /** Convert screen coords to page coords */
  const screenToPage = useCallback((screenX: number, screenY: number) => {
    const s = stateRef.current;
    return {
      x: (screenX - s.x) / s.scale,
      y: (screenY - s.y) / s.scale,
    };
  }, []); // stable ref

  /** Start panning (middle mouse or Space+drag) */
  const startPan = useCallback((screenX: number, screenY: number) => {
    isPanningRef.current = true;
    lastPointerRef.current = { x: screenX, y: screenY };
  }, []);

  /** Continue panning */
  const movePan = useCallback((screenX: number, screenY: number) => {
    if (!isPanningRef.current) return;
    const dx = screenX - lastPointerRef.current.x;
    const dy = screenY - lastPointerRef.current.y;
    lastPointerRef.current = { x: screenX, y: screenY };
    setState((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  /** Stop panning */
  const stopPan = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  return {
    state,
    setState,
    fitToPage,
    handleWheel,
    screenToPage,
    startPan,
    movePan,
    stopPan,
    isPanningRef,
    spaceDownRef,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/whiteboard/useZoomPan.ts
git commit -m "feat: add zoom/pan hook for Konva stage"
```

---

## Chunk 2: Drawing tools

### Task 5: Draw tool (freehand)

**Files:**
- Create: `src/components/whiteboard/tools/useDraw.ts`

- [ ] **Step 1: Write freehand drawing hook**

```ts
"use client";

import { useCallback, useRef } from "react";
import type Konva from "konva";
import { type DrawShape, clampToSheet, createShapeId } from "../types";

interface UseDrawOptions {
  color: string;
  strokeWidth: number;
  onShapeAdd: (shape: DrawShape) => void;
  onDrawingUpdate?: (points: number[], pressures: number[]) => void;
  screenToPage: (x: number, y: number) => { x: number; y: number };
}

export function useDraw({ color, strokeWidth, onShapeAdd, onDrawingUpdate, screenToPage }: UseDrawOptions) {
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<number[]>([]);
  const pressuresRef = useRef<number[]>([]);
  const startPosRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    const pos = screenToPage(e.evt.clientX, e.evt.clientY);
    const clamped = clampToSheet(pos.x, pos.y);

    isDrawingRef.current = true;
    startPosRef.current = clamped;
    pointsRef.current = [0, 0]; // relative to start position
    pressuresRef.current = [e.evt.pressure || 0.5];
  }, [screenToPage]);

  const handlePointerMove = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!isDrawingRef.current) return;

    const pos = screenToPage(e.evt.clientX, e.evt.clientY);
    const clamped = clampToSheet(pos.x, pos.y);
    const relX = clamped.x - startPosRef.current.x;
    const relY = clamped.y - startPosRef.current.y;

    pointsRef.current.push(relX, relY);
    pressuresRef.current.push(e.evt.pressure || 0.5);
    onDrawingUpdate?.([...pointsRef.current], [...pressuresRef.current]);
  }, [screenToPage, onDrawingUpdate]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (pointsRef.current.length < 4) return; // Need at least 2 points

    const shape: DrawShape = {
      id: createShapeId(),
      type: "draw",
      x: startPosRef.current.x,
      y: startPosRef.current.y,
      color,
      props: {
        points: [...pointsRef.current],
        pressures: [...pressuresRef.current],
        strokeWidth,
      },
    };

    onShapeAdd(shape);
    pointsRef.current = [];
    pressuresRef.current = [];
    onDrawingUpdate?.([], []);
  }, [color, strokeWidth, onShapeAdd, onDrawingUpdate]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isDrawingRef,
    pointsRef,
    startPosRef,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/whiteboard/tools/useDraw.ts
git commit -m "feat: add freehand draw tool hook"
```

---

### Task 6: Line tool

**Files:**
- Create: `src/components/whiteboard/tools/useLine.ts`

- [ ] **Step 1: Write line tool hook**

```ts
"use client";

import { useCallback, useRef } from "react";
import type Konva from "konva";
import { type LineShape, clampToSheet, createShapeId } from "../types";

interface UseLineOptions {
  color: string;
  strokeWidth: number;
  onShapeAdd: (shape: LineShape) => void;
  onPreviewUpdate?: (from: { x: number; y: number } | null, to: { x: number; y: number } | null) => void;
  screenToPage: (x: number, y: number) => { x: number; y: number };
}

export function useLine({ color, strokeWidth, onShapeAdd, onPreviewUpdate, screenToPage }: UseLineOptions) {
  const isDrawingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    const pos = screenToPage(e.evt.clientX, e.evt.clientY);
    const clamped = clampToSheet(pos.x, pos.y);
    isDrawingRef.current = true;
    startRef.current = clamped;
  }, [screenToPage]);

  const handlePointerMove = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!isDrawingRef.current) return;
    const pos = screenToPage(e.evt.clientX, e.evt.clientY);
    const clamped = clampToSheet(pos.x, pos.y);
    onPreviewUpdate?.(startRef.current, clamped);
  }, [screenToPage, onPreviewUpdate]);

  const handlePointerUp = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const pos = screenToPage(e.evt.clientX, e.evt.clientY);
    const end = clampToSheet(pos.x, pos.y);
    const start = startRef.current;

    // Minimum length check
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.sqrt(dx * dx + dy * dy) < 3) {
      onPreviewUpdate?.(null, null);
      return;
    }

    const shape: LineShape = {
      id: createShapeId(),
      type: "line",
      x: start.x,
      y: start.y,
      color,
      props: {
        points: [0, 0, end.x - start.x, end.y - start.y],
        strokeWidth,
      },
    };

    onShapeAdd(shape);
    onPreviewUpdate?.(null, null);
  }, [color, strokeWidth, screenToPage, onShapeAdd, onPreviewUpdate]);

  return { handlePointerDown, handlePointerMove, handlePointerUp };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/whiteboard/tools/useLine.ts
git commit -m "feat: add straight line tool hook"
```

---

### Task 7: Eraser tool

**Files:**
- Create: `src/components/whiteboard/tools/useEraser.ts`

- [ ] **Step 1: Write eraser hook**

```ts
"use client";

import { useCallback } from "react";
import type Konva from "konva";
import type { Shape } from "../types";

interface UseEraserOptions {
  shapes: Map<string, Shape>;
  onShapeDelete: (id: string) => void;
  screenToPage: (x: number, y: number) => { x: number; y: number };
}

/** Distance from point to a polyline defined by flat points array */
function distToPolyline(px: number, py: number, points: number[], ox: number, oy: number): number {
  let minDist = Infinity;
  for (let i = 0; i < points.length - 2; i += 2) {
    const x1 = points[i] + ox;
    const y1 = points[i + 1] + oy;
    const x2 = points[i + 2] + ox;
    const y2 = points[i + 3] + oy;
    const dist = distToSegment(px, py, x1, y1, x2, y2);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

export function useEraser({ shapes, onShapeDelete, screenToPage }: UseEraserOptions) {
  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    const pos = screenToPage(e.evt.clientX, e.evt.clientY);
    const hitRadius = 10;

    for (const [id, shape] of shapes) {
      let hit = false;

      switch (shape.type) {
        case "draw":
          hit = distToPolyline(pos.x, pos.y, shape.props.points, shape.x, shape.y) < hitRadius;
          break;
        case "line":
          hit = distToPolyline(pos.x, pos.y, shape.props.points, shape.x, shape.y) < hitRadius;
          break;
        case "text":
          hit = pos.x >= shape.x && pos.x <= shape.x + (shape.props.width || 200) &&
                pos.y >= shape.y && pos.y <= shape.y + shape.props.fontSize * 1.5;
          break;
        case "image":
          hit = pos.x >= shape.x && pos.x <= shape.x + shape.props.width &&
                pos.y >= shape.y && pos.y <= shape.y + shape.props.height;
          break;
      }

      if (hit) {
        onShapeDelete(id);
        return; // Delete one shape per click
      }
    }
  }, [shapes, onShapeDelete, screenToPage]);

  return { handlePointerDown };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/whiteboard/tools/useEraser.ts
git commit -m "feat: add eraser tool hook"
```

---

### Task 8: Text tool

**Files:**
- Create: `src/components/whiteboard/tools/useText.ts`

- [ ] **Step 1: Write text tool hook**

```ts
"use client";

import { useCallback, useRef, useState } from "react";
import type Konva from "konva";
import { type TextShape, clampToSheet, createShapeId, isInSheet } from "../types";

interface UseTextOptions {
  color: string;
  fontSize: number;
  onShapeAdd: (shape: TextShape) => void;
  screenToPage: (x: number, y: number) => { x: number; y: number };
  /** Current zoom scale — needed to position/scale the textarea overlay */
  scale: number;
  /** Stage container offset — needed for textarea positioning */
  stageOffset: { x: number; y: number };
}

export interface TextEditState {
  active: boolean;
  x: number;       // page coords
  y: number;       // page coords
  screenX: number; // screen coords for textarea
  screenY: number;
  content: string;
}

export function useText({ color, fontSize, onShapeAdd, screenToPage, scale, stageOffset }: UseTextOptions) {
  const [editState, setEditState] = useState<TextEditState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    // If already editing, commit current text first
    if (editState) {
      commitText();
    }

    const pos = screenToPage(e.evt.clientX, e.evt.clientY);
    if (!isInSheet(pos.x, pos.y)) return;

    const clamped = clampToSheet(pos.x, pos.y);

    // Calculate screen position for the textarea
    const screenX = clamped.x * scale + stageOffset.x;
    const screenY = clamped.y * scale + stageOffset.y;

    setEditState({
      active: true,
      x: clamped.x,
      y: clamped.y,
      screenX,
      screenY,
      content: "",
    });

    // Focus textarea on next tick
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [editState, screenToPage, scale, stageOffset]);

  const commitText = useCallback(() => {
    if (!editState || !editState.content.trim()) {
      setEditState(null);
      return;
    }

    const shape: TextShape = {
      id: createShapeId(),
      type: "text",
      x: editState.x,
      y: editState.y,
      color,
      props: {
        content: editState.content,
        fontSize,
      },
    };

    onShapeAdd(shape);
    setEditState(null);
  }, [editState, color, fontSize, onShapeAdd]);

  const handleTextChange = useCallback((content: string) => {
    setEditState((prev) => prev ? { ...prev, content } : null);
  }, []);

  const handleTextKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setEditState(null);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitText();
    }
  }, [commitText]);

  return {
    editState,
    textareaRef,
    handlePointerDown,
    commitText,
    handleTextChange,
    handleTextKeyDown,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/whiteboard/tools/useText.ts
git commit -m "feat: add text tool hook with inline editing"
```

---

### Task 9: Select tool

**Files:**
- Create: `src/components/whiteboard/tools/useSelect.ts`

- [ ] **Step 1: Write select tool hook**

```ts
"use client";

import { useCallback, useRef, useState } from "react";
import type Konva from "konva";
import type { Shape } from "../types";

interface UseSelectOptions {
  shapes: Map<string, Shape>;
  onShapeUpdate: (id: string, updates: Partial<Shape>) => void;
  onShapeDelete: (id: string) => void;
  screenToPage: (x: number, y: number) => { x: number; y: number };
}

export function useSelect({ shapes, onShapeUpdate, onShapeDelete, screenToPage }: UseSelectOptions) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const hitTest = useCallback((pageX: number, pageY: number): string | null => {
    // Iterate in reverse (top shapes first)
    const entries = [...shapes.entries()].reverse();
    for (const [id, shape] of entries) {
      switch (shape.type) {
        case "image": {
          if (pageX >= shape.x && pageX <= shape.x + shape.props.width &&
              pageY >= shape.y && pageY <= shape.y + shape.props.height) {
            return id;
          }
          break;
        }
        case "text": {
          const w = shape.props.width || 200;
          const h = shape.props.fontSize * 2;
          if (pageX >= shape.x && pageX <= shape.x + w &&
              pageY >= shape.y && pageY <= shape.y + h) {
            return id;
          }
          break;
        }
        case "draw":
        case "line": {
          // Simple bounding box check for strokes
          const pts = shape.props.points;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (let i = 0; i < pts.length; i += 2) {
            const px = pts[i] + shape.x;
            const py = pts[i + 1] + shape.y;
            minX = Math.min(minX, px);
            minY = Math.min(minY, py);
            maxX = Math.max(maxX, px);
            maxY = Math.max(maxY, py);
          }
          const pad = 8;
          if (pageX >= minX - pad && pageX <= maxX + pad &&
              pageY >= minY - pad && pageY <= maxY + pad) {
            return id;
          }
          break;
        }
      }
    }
    return null;
  }, [shapes]);

  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    const pos = screenToPage(e.evt.clientX, e.evt.clientY);
    const hitId = hitTest(pos.x, pos.y);

    if (hitId) {
      setSelectedId(hitId);
      isDraggingRef.current = true;
      const shape = shapes.get(hitId)!;
      dragOffsetRef.current = { x: pos.x - shape.x, y: pos.y - shape.y };
    } else {
      setSelectedId(null);
    }
  }, [hitTest, screenToPage, shapes]);

  const handlePointerMove = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!isDraggingRef.current || !selectedId) return;
    const pos = screenToPage(e.evt.clientX, e.evt.clientY);
    const newX = pos.x - dragOffsetRef.current.x;
    const newY = pos.y - dragOffsetRef.current.y;
    onShapeUpdate(selectedId, { x: newX, y: newY });
  }, [selectedId, screenToPage, onShapeUpdate]);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (selectedId && (e.key === "Delete" || e.key === "Backspace")) {
      onShapeDelete(selectedId);
      setSelectedId(null);
    }
  }, [selectedId, onShapeDelete]);

  return {
    selectedId,
    setSelectedId,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/whiteboard/tools/useSelect.ts
git commit -m "feat: add select tool hook with move and delete"
```

---

### Task 10: Tool index + Toolbar component

**Files:**
- Create: `src/components/whiteboard/tools/index.ts`
- Create: `src/components/whiteboard/Toolbar.tsx`

- [ ] **Step 1: Create tools/index.ts**

```ts
export { useDraw } from "./useDraw";
export { useLine } from "./useLine";
export { useEraser } from "./useEraser";
export { useText } from "./useText";
export type { TextEditState } from "./useText";
export { useSelect } from "./useSelect";
```

- [ ] **Step 2: Create Toolbar.tsx**

```tsx
"use client";

import { type ToolType, type BackgroundType, COLORS, STROKE_WIDTHS } from "./types";

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
  /** Slot for file upload button */
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
        className="flex items-center justify-center w-9 h-9 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Rückgängig (Strg+Z)"
      >
        ↩
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Wiederholen (Strg+Shift+Z)"
      >
        ↪
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/whiteboard/tools/index.ts src/components/whiteboard/Toolbar.tsx
git commit -m "feat: add toolbar component with tools, colors, stroke widths, undo/redo"
```

---

## Chunk 3: Y.js sync, main canvas, integration

### Task 11: Rewrite Y.js sync hook

**Files:**
- Rewrite: `src/lib/useYjsSync.ts`

- [ ] **Step 1: Rewrite for Shape-based Y.Map**

Replace entire file. Key changes:
- `Y.Map("shapes")` instead of `Y.Map("tldraw_records")`
- Shape interface instead of TLRecord
- `Y.UndoManager` for undo/redo
- No more tldraw store bridge — returns shapes Map + mutators

```ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import type { Shape } from "@/components/whiteboard/types";

export type ConnectionStatus = "connected" | "reconnecting" | "offline";

/* --- Sync protocol --- */
const MSG_SYNC_STEP1 = 0;
const MSG_SYNC_STEP2 = 1;
const MSG_UPDATE = 2;

function encodeSyncStep1(sv: Uint8Array): Uint8Array {
  const msg = new Uint8Array(1 + sv.length);
  msg[0] = MSG_SYNC_STEP1;
  msg.set(sv, 1);
  return msg;
}

function encodeUpdate(update: Uint8Array): Uint8Array {
  const msg = new Uint8Array(1 + update.length);
  msg[0] = MSG_UPDATE;
  msg.set(update, 1);
  return msg;
}

/* --- Hook --- */

interface UseYjsSyncOptions {
  pageId: string;
  token: string | null;
}

interface UseYjsSyncReturn {
  connectionStatus: ConnectionStatus;
  shapes: Map<string, Shape>;
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useYjsSync({ pageId, token }: UseYjsSyncOptions): UseYjsSyncReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("offline");
  const [shapes, setShapes] = useState<Map<string, Shape>>(new Map());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const docRef = useRef<Y.Doc | null>(null);
  const yShapesRef = useRef<Y.Map<Shape> | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const idbRef = useRef<IndexeddbPersistence | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Sync Y.Map state to React state
  const syncToReact = useCallback(() => {
    const yShapes = yShapesRef.current;
    if (!yShapes) return;
    const map = new Map<string, Shape>();
    yShapes.forEach((val, key) => map.set(key, val));
    setShapes(map);
  }, []);

  const updateUndoState = useCallback(() => {
    const um = undoManagerRef.current;
    if (um) {
      setCanUndo(um.undoStack.length > 0);
      setCanRedo(um.redoStack.length > 0);
    }
  }, []);

  // Initialize Y.Doc and connect
  useEffect(() => {
    if (!pageId || !token) return;

    const doc = new Y.Doc();
    docRef.current = doc;
    const yShapes = doc.getMap<Shape>("shapes");
    yShapesRef.current = yShapes;

    // Undo manager
    const undoManager = new Y.UndoManager(yShapes);
    undoManagerRef.current = undoManager;
    undoManager.on("stack-item-added", updateUndoState);
    undoManager.on("stack-item-popped", updateUndoState);

    // IndexedDB persistence
    const idb = new IndexeddbPersistence(`mathboard-page-${pageId}`, doc);
    idbRef.current = idb;

    // Observe Y.Map changes → update React state
    const observer = () => syncToReact();
    yShapes.observeDeep(observer);

    // Load from IDB
    idb.on("synced", () => syncToReact());

    // Y.Doc updates → send over WebSocket
    const docUpdateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(encodeUpdate(update));
      }
    };
    doc.on("update", docUpdateHandler);

    // --- WebSocket ---
    function connectWs() {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/page/${pageId}?token=${encodeURIComponent(token!)}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      setConnectionStatus("reconnecting");

      ws.onopen = () => {
        console.log(`[yjs-sync] Connected to page ${pageId}`);
        setConnectionStatus("connected");
        reconnectAttemptsRef.current = 0;
        const sv = Y.encodeStateVector(doc);
        ws.send(encodeSyncStep1(sv));
      };

      ws.onmessage = (event) => {
        try {
          const data = new Uint8Array(event.data as ArrayBuffer);
          if (data.length === 0) return;
          const msgType = data[0];
          const payload = data.slice(1);
          if (msgType === MSG_SYNC_STEP2 || msgType === MSG_UPDATE) {
            Y.applyUpdate(doc, payload, "remote");
          }
        } catch (err) {
          console.error("[yjs-sync] Error handling message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log(`[yjs-sync] Disconnected (code: ${event.code})`);
        wsRef.current = null;
        if (event.code !== 1000 && event.code !== 1001) {
          setConnectionStatus("reconnecting");
          const attempts = reconnectAttemptsRef.current;
          const delay = Math.min(1000 * 2 ** attempts, 30000);
          reconnectAttemptsRef.current = attempts + 1;
          reconnectTimeoutRef.current = setTimeout(connectWs, delay);
        } else {
          setConnectionStatus("offline");
        }
      };

      ws.onerror = (err) => console.error("[yjs-sync] WebSocket error:", err);
    }

    connectWs();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      yShapes.unobserveDeep(observer);
      doc.off("update", docUpdateHandler);
      undoManager.destroy();
      if (wsRef.current) { wsRef.current.close(1000); wsRef.current = null; }
      if (idbRef.current) { idbRef.current.destroy(); idbRef.current = null; }
      doc.destroy();
      docRef.current = null;
      yShapesRef.current = null;
      undoManagerRef.current = null;
    };
  }, [pageId, token, syncToReact, updateUndoState]);

  // Mutators
  const addShape = useCallback((shape: Shape) => {
    yShapesRef.current?.set(shape.id, shape);
  }, []);

  const updateShape = useCallback((id: string, updates: Partial<Shape>) => {
    const yShapes = yShapesRef.current;
    if (!yShapes) return;
    const existing = yShapes.get(id);
    if (existing) {
      yShapes.set(id, { ...existing, ...updates } as Shape);
    }
  }, []);

  const deleteShape = useCallback((id: string) => {
    yShapesRef.current?.delete(id);
  }, []);

  const undo = useCallback(() => undoManagerRef.current?.undo(), []);
  const redo = useCallback(() => undoManagerRef.current?.redo(), []);

  return { connectionStatus, shapes, addShape, updateShape, deleteShape, undo, redo, canUndo, canRedo };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/useYjsSync.ts
git commit -m "feat: rewrite Y.js sync for Shape model with undo/redo"
```

---

### Task 12: Main WhiteboardCanvas rewrite

**Files:**
- Rewrite: `src/components/whiteboard/WhiteboardCanvas.tsx`
- Modify: `src/components/whiteboard/index.ts`

- [ ] **Step 1: Write the main canvas component**

This is the largest file — it wires together all the tools, backgrounds, zoom/pan, and Y.js sync into a single Konva Stage.

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Line, Text, Image as KonvaImage, Rect, Group } from "react-konva";
import type Konva from "konva";
import {
  type BackgroundType,
  type ToolType,
  type Shape,
  type DrawShape,
  A4_WIDTH_PX,
  A4_HEIGHT_PX,
  COLORS,
  STROKE_WIDTHS,
} from "./types";
import { KonvaBlank, KonvaGrid, KonvaLined, KonvaCoordinate } from "./backgrounds";
import { Toolbar } from "./Toolbar";
import { useDraw } from "./tools/useDraw";
import { useLine } from "./tools/useLine";
import { useEraser } from "./tools/useEraser";
import { useText, type TextEditState } from "./tools/useText";
import { useSelect } from "./tools/useSelect";
import { useZoomPan } from "./useZoomPan";
import { useYjsSync, type ConnectionStatus } from "@/lib/useYjsSync";
import { useWsToken } from "@/lib/useWsToken";
import { FileUploadButton } from "./FileUploadButton";

/* --- Background mapping --- */

const BACKGROUND_COMPONENTS: Record<BackgroundType, React.ComponentType> = {
  BLANK: KonvaBlank,
  GRID: KonvaGrid,
  LINED: KonvaLined,
  COORDINATE: KonvaCoordinate,
};

/* --- Image cache for ImageShape rendering --- */

function useImageElement(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = src;
  }, [src]);
  return image;
}

function ShapeImage({ shape }: { shape: Shape & { type: "image" } }) {
  const image = useImageElement(shape.props.src);
  if (!image) return null;
  return (
    <KonvaImage
      x={shape.x}
      y={shape.y}
      width={shape.props.width}
      height={shape.props.height}
      image={image}
    />
  );
}

/* --- Pressure-aware line rendering --- */

function PressureLine({ shape }: { shape: DrawShape }) {
  const hasPressure = shape.props.pressures && shape.props.pressures.some((p) => p > 0);

  if (!hasPressure) {
    return (
      <Line
        x={shape.x}
        y={shape.y}
        points={shape.props.points}
        stroke={shape.color}
        strokeWidth={shape.props.strokeWidth}
        lineCap="round"
        lineJoin="round"
        tension={0.3}
      />
    );
  }

  // Variable-width rendering via custom sceneFunc
  return (
    <Line
      x={shape.x}
      y={shape.y}
      points={shape.props.points}
      stroke={shape.color}
      strokeWidth={shape.props.strokeWidth}
      lineCap="round"
      lineJoin="round"
      tension={0.3}
      sceneFunc={(ctx, lineShape) => {
        const pts = shape.props.points;
        const pressures = shape.props.pressures!;
        const baseWidth = shape.props.strokeWidth;

        if (pts.length < 4) return;

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = shape.color;

        for (let i = 0; i < pts.length - 2; i += 2) {
          const pressure = pressures[i / 2] || 0.5;
          const nextPressure = pressures[i / 2 + 1] || pressure;
          const avgPressure = (pressure + nextPressure) / 2;
          ctx.lineWidth = baseWidth * (0.3 + avgPressure * 1.4);

          ctx.beginPath();
          ctx.moveTo(pts[i], pts[i + 1]);
          ctx.lineTo(pts[i + 2], pts[i + 3]);
          ctx.stroke();
        }

        lineShape.getSelfRect(); // required for Konva
      }}
    />
  );
}

/* --- Props --- */

export interface WhiteboardCanvasProps {
  backgroundType?: BackgroundType;
  pageId?: string;
  onMount?: (stageRef: Konva.Stage) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  className?: string;
}

/* --- Main component --- */

export function WhiteboardCanvas({
  backgroundType = "BLANK",
  pageId,
  onMount,
  onConnectionStatusChange,
  className,
}: WhiteboardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // Tool state
  const [activeTool, setActiveTool] = useState<ToolType>("draw");
  const [activeColor, setActiveColor] = useState<string>(COLORS[0]);
  const [activeStrokeWidth, setActiveStrokeWidth] = useState<number>(STROKE_WIDTHS[1]);

  // Drawing preview state
  const [drawPreview, setDrawPreview] = useState<{ points: number[]; x: number; y: number } | null>(null);
  const [linePreview, setLinePreview] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);

  // WebSocket token
  const wsToken = useWsToken();

  // Y.js sync
  const {
    connectionStatus,
    shapes,
    addShape,
    updateShape,
    deleteShape,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useYjsSync({ pageId: pageId || "", token: wsToken });

  // Notify parent of connection status
  useEffect(() => {
    onConnectionStatusChange?.(connectionStatus);
  }, [connectionStatus, onConnectionStatusChange]);

  // Container resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Recalculate fit-to-page when container resizes
  useEffect(() => {
    zoomPan.fitToPage();
  }, [containerSize.width, containerSize.height]);

  // Zoom/Pan
  const zoomPan = useZoomPan({
    containerWidth: containerSize.width,
    containerHeight: containerSize.height,
    pageWidth: A4_WIDTH_PX,
    pageHeight: A4_HEIGHT_PX,
  });

  // Notify parent on mount
  useEffect(() => {
    if (stageRef.current) {
      onMount?.(stageRef.current);
    }
  }, [onMount]);

  // Keyboard shortcuts (undo/redo, space for pan)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (e.key === " " && !e.repeat) {
        zoomPan.spaceDownRef.current = true;
      }
      // Delete key for select tool
      if (activeTool === "select" && (e.key === "Delete" || e.key === "Backspace")) {
        selectTool.handleKeyDown(e);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        zoomPan.spaceDownRef.current = false;
        zoomPan.stopPan();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [undo, redo, activeTool, zoomPan, selectTool]);

  // --- Tool hooks ---

  const drawTool = useDraw({
    color: activeColor,
    strokeWidth: activeStrokeWidth,
    onShapeAdd: addShape,
    onDrawingUpdate: (points, _pressures) => {
      if (points.length > 0) {
        setDrawPreview({ points, x: drawTool.startPosRef.current.x, y: drawTool.startPosRef.current.y });
      } else {
        setDrawPreview(null);
      }
    },
    screenToPage: zoomPan.screenToPage,
  });

  const lineTool = useLine({
    color: activeColor,
    strokeWidth: activeStrokeWidth,
    onShapeAdd: addShape,
    onPreviewUpdate: (from, to) => {
      if (from && to) setLinePreview({ from, to });
      else setLinePreview(null);
    },
    screenToPage: zoomPan.screenToPage,
  });

  const eraserTool = useEraser({
    shapes,
    onShapeDelete: deleteShape,
    screenToPage: zoomPan.screenToPage,
  });

  const textTool = useText({
    color: activeColor,
    fontSize: 18,
    onShapeAdd: addShape,
    screenToPage: zoomPan.screenToPage,
    scale: zoomPan.state.scale,
    stageOffset: { x: zoomPan.state.x, y: zoomPan.state.y },
  });

  const selectTool = useSelect({
    shapes,
    onShapeUpdate: (id, updates) => updateShape(id, updates),
    onShapeDelete: deleteShape,
    screenToPage: zoomPan.screenToPage,
  });

  // --- Stage event handlers ---

  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    // Space+drag = pan
    if (zoomPan.spaceDownRef.current) {
      zoomPan.startPan(e.evt.clientX, e.evt.clientY);
      return;
    }
    // Middle mouse = pan
    if (e.evt.button === 1) {
      zoomPan.startPan(e.evt.clientX, e.evt.clientY);
      return;
    }

    switch (activeTool) {
      case "draw": drawTool.handlePointerDown(e); break;
      case "line": lineTool.handlePointerDown(e); break;
      case "eraser": eraserTool.handlePointerDown(e); break;
      case "text": textTool.handlePointerDown(e); break;
      case "select": selectTool.handlePointerDown(e); break;
    }
  }, [activeTool, zoomPan, drawTool, lineTool, eraserTool, textTool, selectTool]);

  const handlePointerMove = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (zoomPan.isPanningRef.current) {
      zoomPan.movePan(e.evt.clientX, e.evt.clientY);
      return;
    }
    switch (activeTool) {
      case "draw": drawTool.handlePointerMove(e); break;
      case "line": lineTool.handlePointerMove(e); break;
      case "select": selectTool.handlePointerMove(e); break;
    }
  }, [activeTool, zoomPan, drawTool, lineTool, selectTool]);

  const handlePointerUp = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (zoomPan.isPanningRef.current) {
      zoomPan.stopPan();
      return;
    }
    switch (activeTool) {
      case "draw": drawTool.handlePointerUp(); break;
      case "line": lineTool.handlePointerUp(e); break;
      case "select": selectTool.handlePointerUp(); break;
    }
  }, [activeTool, zoomPan, drawTool, lineTool, selectTool]);

  // Background component
  const BackgroundComponent = BACKGROUND_COMPONENTS[backgroundType];

  // Cursor
  const cursor = activeTool === "draw" ? "crosshair"
    : activeTool === "eraser" ? "pointer"
    : activeTool === "text" ? "text"
    : activeTool === "line" ? "crosshair"
    : "default";

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#e5e7eb", overflow: "hidden", cursor }}
    >
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        scaleX={zoomPan.state.scale}
        scaleY={zoomPan.state.scale}
        x={zoomPan.state.x}
        y={zoomPan.state.y}
        onWheel={zoomPan.handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Background layer */}
        <Layer>
          <BackgroundComponent />
        </Layer>

        {/* Content layer */}
        <Layer>
          {[...shapes.values()].map((shape) => {
            switch (shape.type) {
              case "draw":
                return <PressureLine key={shape.id} shape={shape} />;
              case "line":
                return (
                  <Line
                    key={shape.id}
                    x={shape.x}
                    y={shape.y}
                    points={shape.props.points}
                    stroke={shape.color}
                    strokeWidth={shape.props.strokeWidth}
                    lineCap="round"
                  />
                );
              case "text":
                return (
                  <Text
                    key={shape.id}
                    x={shape.x}
                    y={shape.y}
                    text={shape.props.content}
                    fontSize={shape.props.fontSize}
                    fill={shape.color}
                    width={shape.props.width}
                  />
                );
              case "image":
                return <ShapeImage key={shape.id} shape={shape} />;
              default:
                return null;
            }
          })}

          {/* Selection indicator */}
          {activeTool === "select" && selectTool.selectedId && shapes.has(selectTool.selectedId) && (() => {
            const sel = shapes.get(selectTool.selectedId!)!;
            let bx = sel.x, by = sel.y, bw = 100, bh = 50;
            if (sel.type === "image") { bw = sel.props.width; bh = sel.props.height; }
            else if (sel.type === "text") { bw = sel.props.width || 200; bh = sel.props.fontSize * 2; }
            else {
              const pts = sel.props.points;
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              for (let i = 0; i < pts.length; i += 2) {
                minX = Math.min(minX, pts[i]); minY = Math.min(minY, pts[i+1]);
                maxX = Math.max(maxX, pts[i]); maxY = Math.max(maxY, pts[i+1]);
              }
              bx = sel.x + minX; by = sel.y + minY; bw = maxX - minX; bh = maxY - minY;
            }
            return <Rect x={bx - 4} y={by - 4} width={bw + 8} height={bh + 8} stroke="#2563eb" strokeWidth={1.5} dash={[6, 3]} listening={false} />;
          })()}
        </Layer>

        {/* Tool overlay layer */}
        <Layer>
          {/* Draw preview */}
          {drawPreview && (
            <Line
              x={drawPreview.x}
              y={drawPreview.y}
              points={drawPreview.points}
              stroke={activeColor}
              strokeWidth={activeStrokeWidth}
              lineCap="round"
              lineJoin="round"
              tension={0.3}
              opacity={0.7}
            />
          )}
          {/* Line preview */}
          {linePreview && (
            <Line
              points={[linePreview.from.x, linePreview.from.y, linePreview.to.x, linePreview.to.y]}
              stroke={activeColor}
              strokeWidth={activeStrokeWidth}
              lineCap="round"
              opacity={0.7}
              dash={[8, 4]}
            />
          )}
        </Layer>
      </Stage>

      {/* Text editing overlay (HTML textarea) */}
      {textTool.editState && (
        <textarea
          ref={textTool.textareaRef}
          value={textTool.editState.content}
          onChange={(e) => textTool.handleTextChange(e.target.value)}
          onKeyDown={textTool.handleTextKeyDown}
          onBlur={() => textTool.commitText()}
          style={{
            position: "absolute",
            left: textTool.editState.screenX,
            top: textTool.editState.screenY,
            fontSize: 18 * zoomPan.state.scale,
            color: activeColor,
            background: "transparent",
            border: "1px dashed #2563eb",
            outline: "none",
            resize: "none",
            minWidth: 100,
            minHeight: 30,
            fontFamily: "sans-serif",
            zIndex: 20,
            transformOrigin: "top left",
          }}
        />
      )}

      {/* Toolbar */}
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        activeColor={activeColor}
        onColorChange={setActiveColor}
        activeStrokeWidth={activeStrokeWidth}
        onStrokeWidthChange={setActiveStrokeWidth}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      >
        {pageId && <FileUploadButton pageId={pageId} onAddImage={addShape} />}
      </Toolbar>
    </div>
  );
}
```

- [ ] **Step 2: Update index.ts exports**

```ts
export { WhiteboardCanvas } from "./WhiteboardCanvas";
export type { WhiteboardCanvasProps } from "./WhiteboardCanvas";
export type { BackgroundType } from "./types";
export { A4_WIDTH_PX, A4_HEIGHT_PX } from "./types";
```

- [ ] **Step 3: Commit**

```bash
git add src/components/whiteboard/WhiteboardCanvas.tsx src/components/whiteboard/index.ts
git commit -m "feat: rewrite WhiteboardCanvas with Konva stage, tools, and zoom/pan"
```

---

### Task 13: Rewrite FileUploadButton

**Files:**
- Rewrite: `src/components/whiteboard/FileUploadButton.tsx`

- [ ] **Step 1: Remove tldraw deps, use Shape model**

Key changes: No more `useEditor`, `track`, `createShapeId` from tldraw. Instead, accept `onAddImage` callback prop.

```tsx
"use client";

import { useRef, useCallback, useState } from "react";
import { useToast } from "@/components/ui/toast";
import type { ImageShape } from "./types";
import { createShapeId } from "./types";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 20;

interface FileUploadButtonProps {
  pageId: string;
  onAddImage: (shape: ImageShape) => void;
}

async function uploadFile(file: File | Blob, pageId: string, filename?: string): Promise<{ id: string; url: string; mimeType: string }> {
  const formData = new FormData();
  if (filename && file instanceof Blob && !(file instanceof File)) {
    formData.append("file", file, filename);
  } else {
    formData.append("file", file);
  }
  formData.append("pageId", pageId);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload fehlgeschlagen");
  }
  return res.json();
}

async function renderPdfPages(file: File): Promise<Blob[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const blobs: Blob[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    });
    blobs.push(blob);
  }
  return blobs;
}

export function FileUploadButton({ pageId, onAddImage }: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);

  const placeImage = useCallback(async (url: string, index: number = 0) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.src = url;
    });

    const maxWidth = 600;
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;

    const shape: ImageShape = {
      id: createShapeId(),
      type: "image",
      x: 100,
      y: 100 + index * (h + 20),
      color: "#000000",
      props: { src: url, width: w, height: h },
    };

    onAddImage(shape);
  }, [onAddImage]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast("Ungültiger Dateityp. Erlaubt: PNG, JPG, WEBP, PDF", "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast("Datei ist zu groß. Maximum: 10MB", "error");
      return;
    }

    setUploading(true);
    try {
      if (file.type === "application/pdf") {
        showToast("PDF wird verarbeitet...", "info");
        let pageBlobs: Blob[];
        try { pageBlobs = await renderPdfPages(file); } catch {
          showToast("PDF konnte nicht verarbeitet werden", "error");
          setUploading(false);
          return;
        }
        if (pageBlobs.length === 0) { showToast("PDF enthält keine Seiten", "error"); setUploading(false); return; }
        const pdfName = file.name.replace(/\.pdf$/i, "");
        for (let i = 0; i < pageBlobs.length; i++) {
          const result = await uploadFile(pageBlobs[i], pageId, `${pdfName}_seite_${i + 1}.png`);
          await placeImage(result.url, i);
        }
        showToast(`PDF hochgeladen: ${pageBlobs.length} Seiten`, "success");
      } else {
        const result = await uploadFile(file, pageId);
        await placeImage(result.url);
        showToast("Bild hochgeladen", "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload fehlgeschlagen", "error");
    } finally {
      setUploading(false);
    }
  }, [pageId, showToast, placeImage]);

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" className="hidden" onChange={handleFileChange} />
      <button
        className="flex items-center justify-center w-9 h-9 rounded-lg text-sm hover:bg-gray-100 text-gray-700"
        title="Datei hochladen (Bild / PDF)"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{ opacity: uploading ? 0.5 : 1, cursor: uploading ? "wait" : "pointer" }}
      >
        {uploading ? (
          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </button>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/whiteboard/FileUploadButton.tsx
git commit -m "feat: rewrite FileUploadButton without tldraw deps"
```

---

### Task 14: Update workspace-content.tsx

**Files:**
- Modify: `src/components/workspace/workspace-content.tsx`

- [ ] **Step 1: Apply these changes to workspace-content.tsx**

Replace the tldraw import:
```diff
-import type { Editor } from "tldraw";
+import type Konva from "konva";
```

Replace the editor ref:
```diff
-  const editorRef = useRef<Editor | null>(null);
+  const stageRef = useRef<Konva.Stage | null>(null);
```

Replace the mount handler:
```diff
-  const handleEditorMount = useCallback((editor: Editor) => {
-    editorRef.current = editor;
+  const handleStageMount = useCallback((stage: Konva.Stage) => {
+    stageRef.current = stage;
   }, []);
```

Replace the PDF export `getEditorSvg` with `getStageImage`:
```diff
   const handlePdfExport = useCallback(async () => {
     ...
     await exportWorkspaceToPdf({
       pages,
       workspaceName: workspace?.name || "Workspace",
       activePageId,
-      getEditorSvg: async () => {
-        const editor = editorRef.current;
-        if (!editor) return null;
-        const shapeIds = editor.getCurrentPageShapeIds();
-        if (shapeIds.size === 0) return null;
-        const result = await editor.getSvgString([...shapeIds]);
-        return result ?? null;
-      },
+      getStageImage: async () => {
+        const stage = stageRef.current;
+        if (!stage) return null;
+        return stage.toDataURL({ pixelRatio: 3 });
+      },
       onProgress: (current, total) => {
```

Replace the canvas onMount prop:
```diff
-  onMount={handleEditorMount}
+  onMount={handleStageMount}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workspace/workspace-content.tsx
git commit -m "feat: update workspace-content to use Konva.Stage instead of tldraw Editor"
```

---

### Task 15: Simplify PDF export

**Files:**
- Rewrite: `src/lib/pdf-export.ts`

- [ ] **Step 1: Replace entire file with simplified version**

```ts
import { jsPDF } from "jspdf";
import type { BackgroundType } from "@/components/whiteboard/types";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export interface PdfPageData {
  id: string;
  title: string | null;
  backgroundType: BackgroundType;
  sortOrder: number;
}

export interface PdfExportOptions {
  pages: PdfPageData[];
  workspaceName: string;
  /** Returns a data URL of the active page's Konva stage (rendered at high DPI) */
  getStageImage?: () => Promise<string | null>;
  activePageId?: string | null;
  onProgress?: (current: number, total: number) => void;
}

function drawTitleOnPdf(pdf: jsPDF, title: string, pageNumber: number, totalPages: number) {
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(title, 10, 8);
  pdf.text(`${pageNumber} / ${totalPages}`, A4_WIDTH_MM - 10, 8, { align: "right" });
}

export async function exportWorkspaceToPdf({
  pages,
  workspaceName,
  getStageImage,
  activePageId,
  onProgress,
}: PdfExportOptions): Promise<void> {
  if (pages.length === 0) throw new Error("Keine Seiten zum Exportieren vorhanden.");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const totalPages = pages.length;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    onProgress?.(i + 1, totalPages);

    if (i > 0) pdf.addPage("a4", "portrait");

    // For the active page, use the Konva stage screenshot
    if (page.id === activePageId && getStageImage) {
      try {
        const dataUrl = await getStageImage();
        if (dataUrl) {
          pdf.addImage(dataUrl, "PNG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
        }
      } catch {
        // Fallback: blank white page
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, "F");
      }
    } else {
      // Non-active pages: white page (content not available without loading each page's stage)
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, "F");
    }

    const title = page.title || `Seite ${i + 1}`;
    drawTitleOnPdf(pdf, title, i + 1, totalPages);
  }

  const filename = `${workspaceName.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_ ]/g, "").trim() || "workspace"}.pdf`;
  pdf.save(filename);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/pdf-export.ts
git commit -m "feat: simplify PDF export to use Konva stage.toDataURL()"
```

---

### Task 16: Update whiteboard-demo page

**Files:**
- Modify: `src/app/whiteboard-demo/page.tsx`

- [ ] **Step 1: Update dynamic import (no changes needed to API)**

The WhiteboardCanvas API is the same (same props). The only change is that SSR still needs to be disabled for Konva. The existing dynamic import should work. Verify and adjust if needed.

- [ ] **Step 2: Commit if changed**

---

### Task 17: Wipe database and clean up

- [ ] **Step 1: Wipe the database**

```bash
npx prisma db push --force-reset
```

This resets the database and recreates all tables from the Prisma schema.

- [ ] **Step 2: Delete test users created during debugging**

Already handled by the force-reset above.

- [ ] **Step 3: Remove old tldraw CSS import references**

Search for any remaining `tldraw` references:

```bash
grep -r "tldraw" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: no results. Fix any remaining references.

- [ ] **Step 4: Verify the app compiles**

```bash
npm run build 2>&1 | head -50
```

Expected: no tldraw-related errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: wipe database and remove all tldraw references"
```

---

### Task 18: End-to-end smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Register a new user and create workspace**

Navigate to `http://localhost:3000/register`, create account, create workspace with a page.

- [ ] **Step 3: Verify drawing tools**

Test each tool: draw, line, text, eraser, select. Verify colors and stroke widths work.

- [ ] **Step 4: Verify zoom/pan**

Mousewheel zoom, Space+drag pan. Verify background scales with content.

- [ ] **Step 5: Verify file upload**

Upload an image, verify it appears on canvas and can be selected/moved/deleted.

- [ ] **Step 6: Verify undo/redo**

Draw something, Cmd+Z to undo, Cmd+Shift+Z to redo.

- [ ] **Step 7: Verify PDF export**

Export workspace as PDF, verify it contains the page with background and content.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete tldraw → Konva.js migration"
```
