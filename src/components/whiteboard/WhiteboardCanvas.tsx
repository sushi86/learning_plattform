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
  createShapeId,
} from "./types";
import { KonvaBlank, KonvaGrid, KonvaLined, KonvaCoordinate } from "./backgrounds";
import { Toolbar } from "./Toolbar";
import { useDraw } from "./tools/useDraw";
import { useLine } from "./tools/useLine";
import { useEraser } from "./tools/useEraser";
import { useText, type TextEditState } from "./tools/useText";
import { useSelect } from "./tools/useSelect";
import { useRectSelect, type AiSelection } from "./tools/useRectSelect";
import { useLassoSelect } from "./tools/useLassoSelect";
import { useZoomPan } from "./useZoomPan";
import { useYjsSync, type ConnectionStatus } from "@/lib/useYjsSync";
import { useWsToken } from "@/lib/useWsToken";
import { FileUploadButton } from "./FileUploadButton";
import { uploadFile } from "./uploadFile";
import { AiButtons } from "./AiButtons";
import { AiStepNode, AiCorrectionNode } from "./AiShapes";
import { AiExplainInput } from "./AiExplainInput";
import type { AiStepShape, AiCorrectionShape, AiSolveResponse, AiCheckResponse, AiExplainResponse } from "@/lib/ai/types";

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
  aiEnabled?: boolean;
}

/* --- Main component --- */

export function WhiteboardCanvas({
  backgroundType = "BLANK",
  pageId,
  onMount,
  onConnectionStatusChange,
  className,
  aiEnabled = false,
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

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [explainTarget, setExplainTarget] = useState<{ shapeId: string; screenX: number; screenY: number } | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

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

  const rectSelect = useRectSelect({
    screenToPage: zoomPan.screenToPage,
  });

  const lassoSelect = useLassoSelect({
    screenToPage: zoomPan.screenToPage,
  });

  // Compute active AI selection based on tool
  const aiSelection: AiSelection | null =
    activeTool === "rect-select" ? rectSelect.selection :
    activeTool === "lasso-select" ? lassoSelect.selection :
    null;

  // Screenshot capture for AI
  const captureSelection = useCallback((bounds: { x: number; y: number; width: number; height: number }): string | null => {
    const stage = stageRef.current;
    if (!stage) return null;

    // Save current transform
    const prevScale = { x: stage.scaleX(), y: stage.scaleY() };
    const prevPos = { x: stage.x(), y: stage.y() };

    // Reset to identity transform
    stage.scaleX(1);
    stage.scaleY(1);
    stage.x(0);
    stage.y(0);

    const dataUrl = stage.toDataURL({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      pixelRatio: 2,
    });

    // Restore transform
    stage.scaleX(prevScale.x);
    stage.scaleY(prevScale.y);
    stage.x(prevPos.x);
    stage.y(prevPos.y);

    // Strip data URL prefix to get base64
    return dataUrl.replace(/^data:image\/\w+;base64,/, "");
  }, []);

  // Handle AI Solve
  const handleAiSolve = useCallback(async () => {
    if (!aiSelection || !pageId) return;
    const image = captureSelection(aiSelection.bounds);
    if (!image) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch("/api/ai/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, pageId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "KI-Fehler");
      }

      const result: AiSolveResponse = await res.json();
      const groupId = createShapeId();
      const stepHeight = 60;
      const totalNeeded = result.steps.length * stepHeight;
      const selBottom = aiSelection.bounds.y + aiSelection.bounds.height;

      // Find the lowest existing shape to avoid overlaps
      let lowestY = selBottom;
      for (const s of shapes.values()) {
        let shapeBottom = s.y;
        if (s.type === "draw" || s.type === "line") {
          const pts = s.props.points;
          for (let i = 1; i < pts.length; i += 2) shapeBottom = Math.max(shapeBottom, s.y + pts[i]);
        } else if (s.type === "image") {
          shapeBottom = s.y + s.props.height;
        } else if (s.type === "ai-step") {
          shapeBottom = s.y + 50;
        } else if (s.type === "ai-correction") {
          shapeBottom = s.y + 80;
        } else if (s.type === "text") {
          shapeBottom = s.y + (s.props.fontSize || 18) * 2;
        }
        // Only consider shapes near the selection x range
        if (shapeBottom > selBottom && shapeBottom > lowestY) {
          lowestY = shapeBottom;
        }
      }

      // Place 30px below the selection or lowest overlapping content
      let startY = selBottom + 30;
      // If that would overlap existing content below, push further down
      if (lowestY > selBottom && lowestY < selBottom + totalNeeded + 30) {
        startY = lowestY + 30;
      }
      // If response would overflow page, start on next page area
      const pageBottom = Math.ceil(startY / A4_HEIGHT_PX) * A4_HEIGHT_PX;
      if (startY + totalNeeded > pageBottom && startY + totalNeeded - pageBottom > totalNeeded * 0.3) {
        startY = pageBottom + 40;
      }

      result.steps.forEach((step, i) => {
        addShape({
          id: createShapeId(),
          type: "ai-step",
          x: aiSelection.bounds.x,
          y: startY + i * stepHeight,
          color: "#7c3aed",
          source: "ai",
          props: {
            text: step.text,
            explanation: step.explanation,
            stepIndex: i,
            groupId,
          },
        } as AiStepShape);
      });

      // Clear selection
      if (activeTool === "rect-select") rectSelect.clearSelection();
      else if (activeTool === "lasso-select") lassoSelect.clearSelection();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "KI-Fehler");
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setAiLoading(false);
    }
  }, [aiSelection, pageId, captureSelection, addShape, activeTool, rectSelect, lassoSelect]);

  // Handle AI Check
  const handleAiCheck = useCallback(async () => {
    if (!aiSelection || !pageId) return;
    const image = captureSelection(aiSelection.bounds);
    if (!image) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch("/api/ai/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, pageId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "KI-Fehler");
      }

      const result: AiCheckResponse = await res.json();
      const groupId = createShapeId();
      const stepHeight = 80;
      const totalNeeded = result.steps.length * stepHeight;
      const selBottom = aiSelection.bounds.y + aiSelection.bounds.height;

      // Find the lowest existing shape to avoid overlaps
      let lowestY = selBottom;
      for (const s of shapes.values()) {
        let shapeBottom = s.y;
        if (s.type === "draw" || s.type === "line") {
          const pts = s.props.points;
          for (let i = 1; i < pts.length; i += 2) shapeBottom = Math.max(shapeBottom, s.y + pts[i]);
        } else if (s.type === "image") {
          shapeBottom = s.y + s.props.height;
        } else if (s.type === "ai-step") {
          shapeBottom = s.y + 50;
        } else if (s.type === "ai-correction") {
          shapeBottom = s.y + 80;
        } else if (s.type === "text") {
          shapeBottom = s.y + (s.props.fontSize || 18) * 2;
        }
        if (shapeBottom > selBottom && shapeBottom > lowestY) {
          lowestY = shapeBottom;
        }
      }

      let startY = selBottom + 30;
      if (lowestY > selBottom && lowestY < selBottom + totalNeeded + 30) {
        startY = lowestY + 30;
      }
      const pageBottom = Math.ceil(startY / A4_HEIGHT_PX) * A4_HEIGHT_PX;
      if (startY + totalNeeded > pageBottom && startY + totalNeeded - pageBottom > totalNeeded * 0.3) {
        startY = pageBottom + 40;
      }

      result.steps.forEach((step, i) => {
        addShape({
          id: createShapeId(),
          type: "ai-correction",
          x: aiSelection.bounds.x,
          y: startY + i * stepHeight,
          color: step.isCorrect ? "#16a34a" : "#dc2626",
          source: "ai",
          props: {
            text: step.studentStep,
            isCorrect: step.isCorrect,
            correction: step.correction,
            rule: step.rule,
            hint: i === result.steps.length - 1 ? result.hint : undefined,
            stepIndex: i,
            groupId,
          },
        } as AiCorrectionShape);
      });

      // Clear selection
      if (activeTool === "rect-select") rectSelect.clearSelection();
      else if (activeTool === "lasso-select") lassoSelect.clearSelection();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "KI-Fehler");
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setAiLoading(false);
    }
  }, [aiSelection, pageId, captureSelection, addShape, activeTool, rectSelect, lassoSelect]);

  // Handle AI selection cancel
  const handleAiCancel = useCallback(() => {
    if (activeTool === "rect-select") rectSelect.clearSelection();
    else if (activeTool === "lasso-select") lassoSelect.clearSelection();
  }, [activeTool, rectSelect, lassoSelect]);

  // Handle clicking an AI step shape for follow-up
  const handleAiStepClick = useCallback((shapeId: string) => {
    if (activeTool !== "select") return;
    const shape = shapes.get(shapeId);
    if (!shape || shape.type !== "ai-step") return;

    const screenX = shape.x * zoomPan.state.scale + zoomPan.state.x;
    const screenY = (shape.y + 50) * zoomPan.state.scale + zoomPan.state.y;
    setExplainTarget({ shapeId, screenX, screenY });
  }, [activeTool, shapes, zoomPan.state]);

  // Handle explain submission
  const handleExplainSubmit = useCallback(async (question: string) => {
    if (!explainTarget || !pageId) return;
    const shape = shapes.get(explainTarget.shapeId) as AiStepShape | undefined;
    if (!shape) return;

    setExplainLoading(true);

    // Gather all steps in same group as context
    const allSteps = [...shapes.values()]
      .filter((s): s is AiStepShape => s.type === "ai-step" && s.props.groupId === shape.props.groupId)
      .sort((a, b) => a.props.stepIndex - b.props.stepIndex);

    const previousSteps = allSteps
      .filter((s) => s.props.stepIndex <= shape.props.stepIndex)
      .map((s) => ({ text: s.props.text, explanation: s.props.explanation }));

    // Capture a screenshot of the area around this shape
    const image = captureSelection({
      x: Math.max(0, shape.x - 50),
      y: Math.max(0, shape.y - 50),
      width: 500,
      height: 200,
    });

    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: image || "",
          previousSteps,
          step: shape.props.text,
          question,
          pageId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "KI-Fehler");
      }

      const result: AiExplainResponse = await res.json();

      // Add explanation as a new AI step below the clicked shape
      addShape({
        id: createShapeId(),
        type: "ai-step",
        x: shape.x + 20,
        y: shape.y + 60,
        color: "#7c3aed",
        source: "ai",
        props: {
          text: `Frage: ${question}`,
          explanation: result.explanation,
          stepIndex: shape.props.stepIndex + 100, // offset to not collide
          groupId: shape.props.groupId,
        },
      } as AiStepShape);

      if (result.additionalSteps) {
        result.additionalSteps.forEach((step, i) => {
          addShape({
            id: createShapeId(),
            type: "ai-step",
            x: shape.x + 20,
            y: shape.y + 120 + i * 60,
            color: "#7c3aed",
            source: "ai",
            props: {
              text: step.text,
              explanation: step.explanation,
              stepIndex: shape.props.stepIndex + 101 + i,
              groupId: shape.props.groupId,
            },
          } as AiStepShape);
        });
      }

      setExplainTarget(null);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "KI-Fehler");
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setExplainLoading(false);
    }
  }, [explainTarget, pageId, shapes, captureSelection, addShape]);

  // Paste image from clipboard (Cmd+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!pageId) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          try {
            const result = await uploadFile(blob, pageId, `paste-${Date.now()}.png`);

            // Load image to get dimensions
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject();
              img.src = result.url;
            });

            const maxWidth = 600;
            const scale = Math.min(1, maxWidth / img.naturalWidth);
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;

            addShape({
              id: createShapeId(),
              type: "image",
              x: 100,
              y: 100,
              color: "#000000",
              props: { src: result.url, width: w, height: h },
            });
          } catch {
            // Upload failed silently
          }
          return;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [pageId, addShape]);

  // Copy/Cut selected shapes to localStorage clipboard
  const copySelectedShapes = useCallback((cut: boolean) => {
    if (selectTool.selectedIds.size === 0) return;
    const copied: Shape[] = [];
    for (const id of selectTool.selectedIds) {
      const shape = shapes.get(id);
      if (shape) copied.push(structuredClone(shape));
    }
    if (copied.length === 0) return;
    localStorage.setItem("mathboard-clipboard", JSON.stringify(copied));
    if (cut) {
      for (const id of selectTool.selectedIds) {
        deleteShape(id);
      }
      selectTool.setSelectedIds(new Set());
    }
  }, [selectTool, shapes, deleteShape]);

  // Paste shapes from localStorage clipboard
  const pasteShapes = useCallback(() => {
    const raw = localStorage.getItem("mathboard-clipboard");
    if (!raw) return;
    try {
      const copied: Shape[] = JSON.parse(raw);
      const newIds = new Set<string>();
      const OFFSET = 20;
      for (const shape of copied) {
        const newId = createShapeId();
        newIds.add(newId);
        addShape({ ...shape, id: newId, x: shape.x + OFFSET, y: shape.y + OFFSET });
      }
      // Update clipboard with offset positions so repeated paste cascades
      const shifted = copied.map((s) => ({ ...s, x: s.x + OFFSET, y: s.y + OFFSET }));
      localStorage.setItem("mathboard-clipboard", JSON.stringify(shifted));
      selectTool.setSelectedIds(newIds);
    } catch {
      // Invalid clipboard data
    }
  }, [addShape, selectTool]);

  // Keyboard shortcuts (undo/redo, space for pan, copy/cut/paste)
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
      // Copy (Cmd+C)
      if ((e.metaKey || e.ctrlKey) && e.key === "c" && activeTool === "select") {
        e.preventDefault();
        copySelectedShapes(false);
      }
      // Cut (Cmd+X)
      if ((e.metaKey || e.ctrlKey) && e.key === "x" && activeTool === "select") {
        e.preventDefault();
        copySelectedShapes(true);
      }
      // Paste (Cmd+V) — only paste shapes when in select tool; image paste handled separately
      if ((e.metaKey || e.ctrlKey) && e.key === "v" && activeTool === "select") {
        // Check if clipboard has shapes (don't interfere with image paste)
        const raw = localStorage.getItem("mathboard-clipboard");
        if (raw) {
          e.preventDefault();
          pasteShapes();
        }
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
  }, [undo, redo, activeTool, zoomPan, selectTool, copySelectedShapes, pasteShapes]);

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
      case "rect-select": rectSelect.handlePointerDown(e); break;
      case "lasso-select": lassoSelect.handlePointerDown(e); break;
    }
  }, [activeTool, zoomPan, drawTool, lineTool, eraserTool, textTool, selectTool, rectSelect, lassoSelect]);

  const handlePointerMove = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (zoomPan.isPanningRef.current) {
      zoomPan.movePan(e.evt.clientX, e.evt.clientY);
      return;
    }
    switch (activeTool) {
      case "draw": drawTool.handlePointerMove(e); break;
      case "line": lineTool.handlePointerMove(e); break;
      case "select": selectTool.handlePointerMove(e); break;
      case "rect-select": rectSelect.handlePointerMove(e); break;
      case "lasso-select": lassoSelect.handlePointerMove(e); break;
    }
  }, [activeTool, zoomPan, drawTool, lineTool, selectTool, rectSelect, lassoSelect]);

  const handlePointerUp = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (zoomPan.isPanningRef.current) {
      zoomPan.stopPan();
      return;
    }
    switch (activeTool) {
      case "draw": drawTool.handlePointerUp(); break;
      case "line": lineTool.handlePointerUp(e); break;
      case "select": selectTool.handlePointerUp(); break;
      case "rect-select": rectSelect.handlePointerUp(); break;
      case "lasso-select": lassoSelect.handlePointerUp(); break;
    }
  }, [activeTool, zoomPan, drawTool, lineTool, selectTool, rectSelect, lassoSelect]);

  // Background component
  const BackgroundComponent = BACKGROUND_COMPONENTS[backgroundType];

  // Cursor
  const cursor = activeTool === "draw" ? "crosshair"
    : activeTool === "eraser" ? "pointer"
    : activeTool === "text" ? "text"
    : activeTool === "line" ? "crosshair"
    : activeTool === "rect-select" || activeTool === "lasso-select" ? "crosshair"
    : "default";

  // Live preview from state (triggers re-renders)
  const rectPreview = activeTool === "rect-select" && rectSelect.drawing ? rectSelect.preview : null;
  const lassoPreview = activeTool === "lasso-select" && lassoSelect.drawing ? lassoSelect.previewPoints : null;

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
              case "ai-step":
                return (
                  <AiStepNode
                    key={shape.id}
                    shape={shape}
                    onClick={() => handleAiStepClick(shape.id)}
                  />
                );
              case "ai-correction":
                return <AiCorrectionNode key={shape.id} shape={shape} />;
              default:
                return null;
            }
          })}

          {/* Selection indicators for all selected shapes */}
          {activeTool === "select" && selectTool.selectedIds.size > 0 && [...selectTool.selectedIds].map((id) => {
            const sel = shapes.get(id);
            if (!sel) return null;
            let bx = sel.x, by = sel.y, bw = 100, bh = 50;
            if (sel.type === "image") { bw = sel.props.width; bh = sel.props.height; }
            else if (sel.type === "text") { bw = sel.props.width || 200; bh = sel.props.fontSize * 2; }
            else if (sel.type === "ai-step" || sel.type === "ai-correction") { bw = 300; bh = 80; }
            else {
              const pts = sel.props.points;
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              for (let i = 0; i < pts.length; i += 2) {
                minX = Math.min(minX, pts[i]); minY = Math.min(minY, pts[i+1]);
                maxX = Math.max(maxX, pts[i]); maxY = Math.max(maxY, pts[i+1]);
              }
              bx = sel.x + minX; by = sel.y + minY; bw = maxX - minX; bh = maxY - minY;
            }
            return (
              <Group key={`sel-${id}`}>
                <Rect x={bx - 4} y={by - 4} width={bw + 8} height={bh + 8} stroke="#2563eb" strokeWidth={1.5} dash={[6, 3]} listening={false} />
                {sel.type === "image" && selectTool.selectedIds.size === 1 && (
                  <Rect
                    x={bx + bw - 4}
                    y={by + bh - 4}
                    width={10}
                    height={10}
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth={1}
                    cornerRadius={2}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}
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
          {/* Select-tool rectangle selection preview */}
          {selectTool.rectPreview && (
            <Rect
              x={selectTool.rectPreview.x}
              y={selectTool.rectPreview.y}
              width={selectTool.rectPreview.width}
              height={selectTool.rectPreview.height}
              stroke="#2563eb"
              strokeWidth={1.5}
              dash={[6, 3]}
              fill="rgba(37, 99, 235, 0.06)"
              listening={false}
            />
          )}
          {/* Rect-select preview during drawing */}
          {rectPreview && (
            <Rect
              x={rectPreview.x}
              y={rectPreview.y}
              width={rectPreview.width}
              height={rectPreview.height}
              stroke="#7c3aed"
              strokeWidth={2}
              dash={[8, 4]}
              fill="rgba(124, 58, 237, 0.05)"
              listening={false}
            />
          )}
          {/* Lasso-select preview during drawing */}
          {lassoPreview && lassoPreview.length >= 4 && (
            <Line
              points={lassoPreview}
              stroke="#7c3aed"
              strokeWidth={2}
              dash={[8, 4]}
              closed={false}
              listening={false}
            />
          )}
          {/* AI selection overlay (after completed selection) */}
          {aiSelection && !aiLoading && (
            activeTool === "rect-select" ? (
              <Rect
                x={aiSelection.bounds.x}
                y={aiSelection.bounds.y}
                width={aiSelection.bounds.width}
                height={aiSelection.bounds.height}
                stroke="#7c3aed"
                strokeWidth={2}
                dash={[8, 4]}
                fill="rgba(124, 58, 237, 0.08)"
                listening={false}
              />
            ) : activeTool === "lasso-select" ? (
              <Line
                points={aiSelection.points}
                stroke="#7c3aed"
                strokeWidth={2}
                dash={[8, 4]}
                closed
                fill="rgba(124, 58, 237, 0.08)"
                listening={false}
              />
            ) : null
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

      {/* AI action buttons */}
      {aiSelection && (
        <AiButtons
          selection={aiSelection}
          aiEnabled={aiEnabled}
          loading={aiLoading}
          onSolve={handleAiSolve}
          onCheck={handleAiCheck}
          onCancel={handleAiCancel}
          scale={zoomPan.state.scale}
          stageX={zoomPan.state.x}
          stageY={zoomPan.state.y}
        />
      )}

      {/* AI explain input */}
      {explainTarget && (
        <AiExplainInput
          screenX={explainTarget.screenX}
          screenY={explainTarget.screenY}
          loading={explainLoading}
          onSubmit={handleExplainSubmit}
          onCancel={() => setExplainTarget(null)}
        />
      )}

      {/* AI error toast */}
      {aiError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 rounded-lg bg-red-100 border border-red-300 px-4 py-2 text-sm text-red-700 shadow-lg">
          {aiError}
        </div>
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
