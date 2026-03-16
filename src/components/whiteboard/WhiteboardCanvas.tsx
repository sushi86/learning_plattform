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
  const stageRef = useRef<Konva.Stage>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // Zoom/Pan (must be before fitToPage useEffect)
  const zoomPan = useZoomPan({
    containerWidth: containerSize.width,
    containerHeight: containerSize.height,
    pageWidth: A4_WIDTH_PX,
    pageHeight: A4_HEIGHT_PX,
  });

  // Use the containerRef from zoomPan so screenToPage knows the container offset
  const containerRef = zoomPan.containerRef;

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

  // Notify parent on mount
  useEffect(() => {
    if (stageRef.current) {
      onMount?.(stageRef.current);
    }
  }, [onMount]);

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
