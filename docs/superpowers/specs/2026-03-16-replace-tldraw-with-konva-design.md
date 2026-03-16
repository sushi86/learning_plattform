# Replace tldraw with Konva.js

## Problem

tldraw requires a commercial license for production use. MathBoard uses it as a drawing engine on fixed A4 pages — none of tldraw's infinite canvas features are needed. The background is currently a fixed overlay that doesn't move with zoom/pan.

## Decision

Replace tldraw with Konva.js (MIT license) and react-konva. Build custom drawing tools. Make the A4 sheet part of the canvas world so background zooms and pans with content.

**Intentionally out of scope:** Arrow, Rectangle, Circle/Ellipse tools. These were in the original design spec but are not needed for the current use case. Can be added later if needed.

## Architecture

### Stage & Layer Structure

The A4 sheet is a Konva Stage (794x1123px at 96 DPI). The stage sits in a container div that fills available space. Outside the sheet is a neutral gray background (CSS on the container).

**Layers (bottom to top):**

1. **Background Layer** — White rectangle + pattern (Grid/Lined/Coordinate/Blank). Non-interactive.
2. **Content Layer** — All shapes (draw strokes, lines, text, images). Interactive.
3. **Tool Overlay Layer** — Active stroke preview while drawing.

### Data Model

```ts
type ShapeType = "draw" | "line" | "text" | "image";

interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  color: string;
}

interface DrawShape extends BaseShape {
  type: "draw";
  props: {
    points: number[];       // flat array [x1,y1,x2,y2,...] relative to x,y
    pressures?: number[];   // pressure per point (0-1), same length as points/2
    strokeWidth: number;
  };
}

interface LineShape extends BaseShape {
  type: "line";
  props: {
    points: [number, number, number, number]; // [x1,y1,x2,y2] relative to x,y
    strokeWidth: number;
  };
}

interface TextShape extends BaseShape {
  type: "text";
  props: {
    content: string;
    fontSize: number;
  };
}

interface ImageShape extends BaseShape {
  type: "image";
  props: {
    src: string;
    width: number;
    height: number;
  };
}

type Shape = DrawShape | LineShape | TextShape | ImageShape;
```

### Tools

6 tools, selected via toolbar:

| Tool | Behavior |
|------|----------|
| **Select** | Click to select shapes. Drag to move. Handles on images for resize. Delete key to remove selected shape. |
| **Stift** (draw) | Freehand drawing. Records point array + optional pressure on pointerdown→pointermove→pointerup. Points clipped to sheet bounds. |
| **Radierer** (eraser) | Touch a shape to delete it entirely (shape-level eraser, not pixel). |
| **Text** | Click to place editable text field. Inline editing via HTML textarea overlay, positioned and scaled to match current zoom/pan transform. |
| **Linie** | Click-drag for straight line. Preview shown during drag. |
| **Farbwähler** | Palette: black, red, blue, green, orange, purple. 3 stroke widths (thin/medium/thick). Applies to next drawn shape. |

**Toolbar position:** Bottom center, horizontal. File upload button remains alongside.

### Pressure Sensitivity (Apple Pencil)

- `PointerEvent.pressure` captured during freehand drawing and stored in `pressures` array
- Rendering: Konva `Line` with `sceneFunc` override that varies `lineWidth` per segment based on pressure
- Fallback: if `pressure` is always 0 (mouse/trackpad), use uniform `strokeWidth`
- Low implementation cost — pressure data is just an extra array, rendering is a custom draw function

### Undo/Redo

- Implemented via `Y.UndoManager` scoped to the `shapes` Y.Map
- Tracks local changes only (not remote collaborator changes)
- Keyboard shortcuts: Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo)
- Toolbar buttons for undo/redo as well
- Captures: shape creation, deletion, movement, text edits

### Zoom & Pan

- **Zoom:** Mousewheel / pinch-to-zoom. Range: 25%–300%. Zoom center: pointer/pinch midpoint. Transforms entire stage (background + content scale together).
- **Pan:** Middle mouse button drag, or two-finger drag on iPad, or Space+drag. Also available via drag tool in toolbar.
- **Initial view:** Sheet centered in viewport, fit-to-page with padding.
- **Implementation:** Konva Stage `scaleX`/`scaleY` + `x`/`y` offset. Single transform for everything.

### Sheet Boundary

- Drawing constrained to (0,0)–(794,1123).
- Freehand points outside bounds are clamped to nearest edge.
- Line endpoints clamped to bounds.
- Text placement clamped to bounds.
- The gray area outside the sheet does not respond to drawing tools.

### Y.js Sync

**Bridge (client-side):**
- `Y.Map<Shape>("shapes")` — one entry per shape
- Local change → update Y.Map → Y.Doc update → WebSocket
- Remote Y.Map change → update Konva shapes
- Origin tagging ("local" / "remote") to prevent echo loops
- **Live drawing sync:** During active freehand drawing, new points are appended to a `Y.Array` inside the shape entry. Y.js sends only the delta (new points), not the entire stroke. Remote users see strokes appear in real-time. On `pointerup`, the shape is finalized. This enables live collaboration (e.g., teacher watches student drawing) with minimal network overhead.

**Server-side:** No changes. `yjs-rooms.ts` only handles Y.Doc binary updates, agnostic to content structure. WebSocket protocol unchanged.

**Offline:** `y-indexeddb` retained for offline persistence.

**`canvasState` column:** Periodically written as `Record<string, Shape>` JSON snapshot (same as before but with new Shape types instead of TLRecord). Used for debugging and disaster recovery.

### Backgrounds

Same 4 types (BLANK, GRID, LINED, COORDINATE). Rendered as Konva shapes on the Background Layer instead of HTML/SVG overlays:

- **BLANK:** White Rect only
- **GRID:** White Rect + repeated Line shapes (5mm spacing)
- **LINED:** White Rect + horizontal lines (8mm spacing, top margin)
- **COORDINATE:** White Rect + grid lines + axes + labels

Since backgrounds are Konva shapes, they transform with zoom/pan automatically.

### PDF Export

- Replace `editor.getSvgString()` with `stage.toDataURL({ pixelRatio: 3 })` for ~288 DPI output
- Remove separate background SVG generators (backgrounds are already on canvas)
- jsPDF multi-page logic, title headers unchanged

### File Upload (Images/PDFs)

- `FileUploadButton` rewritten to not depend on tldraw APIs (`useEditor`, `track`, `createShapeId`, `AssetRecordType`)
- Instead: creates an `ImageShape` and adds it to the Y.Map
- Images can be selected, moved, resized, and deleted via the Select tool
- Upload API (`/api/upload`) unchanged
- PDF-to-image rendering (`pdfjs-dist`) unchanged

## What Changes

| Component | Change |
|-----------|--------|
| `WhiteboardCanvas.tsx` | Complete rewrite: Konva Stage instead of `<Tldraw>` |
| `FileUploadButton.tsx` | Rewrite: remove tldraw deps, use Shape model |
| `useYjsSync.ts` | Rewrite: Shape-based Y.Map instead of TLRecord-based |
| `backgrounds/*.tsx` | Rewrite: Konva shapes instead of HTML/SVG overlays |
| `types.ts` | Add Shape types, keep A4 dimensions |
| `pdf-export.ts` | Simplify: use stage.toDataURL() instead of tldraw SVG |
| `package.json` | Remove `tldraw`, add `konva` + `react-konva` |
| `workspace-content.tsx` | Remove tldraw Editor type, use Konva stage ref for PDF |

## What Does NOT Change

| Component | Reason |
|-----------|--------|
| `server.ts` | WebSocket server unchanged |
| `yjs-rooms.ts` | Y.Doc agnostic to content |
| `ws-auth.ts` | Auth unchanged |
| All API routes | No whiteboard dependency |
| Page sidebar | No tldraw dependency |
| Member management | No tldraw dependency |
| Connection status | Interface unchanged |

## Migration

- Wipe database completely (only test data exists)
- `yDocState` and `canvasState` columns remain — new format written automatically
- Remove tldraw package and CSS
- No schema migration needed

## Dependencies

**Remove:** `tldraw`
**Add:** `konva`, `react-konva`
**Keep:** `yjs`, `y-indexeddb`, `jspdf`, `pdfjs-dist`
