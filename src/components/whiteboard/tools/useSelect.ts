"use client";

import { useCallback, useRef, useState } from "react";
import type Konva from "konva";
import type { Shape, ImageShape } from "../types";

interface UseSelectOptions {
  shapes: Map<string, Shape>;
  onShapeUpdate: (id: string, updates: Partial<Shape>) => void;
  onShapeDelete: (id: string) => void;
  screenToPage: (x: number, y: number) => { x: number; y: number };
}

type InteractionMode = "none" | "move" | "resize";

/** Get bounding box for any shape */
export function getShapeBounds(shape: Shape): { x: number; y: number; w: number; h: number } {
  switch (shape.type) {
    case "image":
      return { x: shape.x, y: shape.y, w: shape.props.width, h: shape.props.height };
    case "text":
      return { x: shape.x, y: shape.y, w: shape.props.width || 200, h: shape.props.fontSize * 2 };
    case "draw":
    case "line": {
      const pts = shape.props.points;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        minX = Math.min(minX, pts[i]);
        minY = Math.min(minY, pts[i + 1]);
        maxX = Math.max(maxX, pts[i]);
        maxY = Math.max(maxY, pts[i + 1]);
      }
      return { x: shape.x + minX, y: shape.y + minY, w: maxX - minX, h: maxY - minY };
    }
  }
}

const HANDLE_SIZE = 8;

/** Check if a point hits a resize handle (bottom-right corner) */
function hitsResizeHandle(
  pageX: number,
  pageY: number,
  shape: Shape,
): boolean {
  if (shape.type !== "image") return false;
  const handleX = shape.x + shape.props.width;
  const handleY = shape.y + shape.props.height;
  const pad = HANDLE_SIZE + 4;
  return Math.abs(pageX - handleX) < pad && Math.abs(pageY - handleY) < pad;
}

export function useSelect({ shapes, onShapeUpdate, onShapeDelete, screenToPage }: UseSelectOptions) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const modeRef = useRef<InteractionMode>("none");
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ mouseX: 0, mouseY: 0, origW: 0, origH: 0 });

  const hitTest = useCallback((pageX: number, pageY: number): string | null => {
    const entries = [...shapes.entries()].reverse();
    for (const [id, shape] of entries) {
      const b = getShapeBounds(shape);
      const pad = shape.type === "draw" || shape.type === "line" ? 8 : 0;
      if (pageX >= b.x - pad && pageX <= b.x + b.w + pad &&
          pageY >= b.y - pad && pageY <= b.y + b.h + pad) {
        return id;
      }
    }
    return null;
  }, [shapes]);

  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    const pos = screenToPage(e.evt.clientX, e.evt.clientY);

    // Check if clicking a resize handle on the currently selected shape
    if (selectedId) {
      const sel = shapes.get(selectedId);
      if (sel && hitsResizeHandle(pos.x, pos.y, sel)) {
        modeRef.current = "resize";
        const imgShape = sel as ImageShape;
        resizeStartRef.current = {
          mouseX: pos.x,
          mouseY: pos.y,
          origW: imgShape.props.width,
          origH: imgShape.props.height,
        };
        return;
      }
    }

    const hitId = hitTest(pos.x, pos.y);

    if (hitId) {
      setSelectedId(hitId);
      modeRef.current = "move";
      const shape = shapes.get(hitId)!;
      dragOffsetRef.current = { x: pos.x - shape.x, y: pos.y - shape.y };
    } else {
      setSelectedId(null);
      modeRef.current = "none";
    }
  }, [hitTest, screenToPage, shapes, selectedId]);

  const handlePointerMove = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!selectedId || modeRef.current === "none") return;
    const pos = screenToPage(e.evt.clientX, e.evt.clientY);

    if (modeRef.current === "move") {
      const newX = pos.x - dragOffsetRef.current.x;
      const newY = pos.y - dragOffsetRef.current.y;
      onShapeUpdate(selectedId, { x: newX, y: newY });
    } else if (modeRef.current === "resize") {
      const shape = shapes.get(selectedId);
      if (!shape || shape.type !== "image") return;

      const dx = pos.x - resizeStartRef.current.mouseX;
      const dy = pos.y - resizeStartRef.current.mouseY;
      // Use the larger delta to maintain aspect ratio
      const aspectRatio = resizeStartRef.current.origW / resizeStartRef.current.origH;
      let newW = Math.max(30, resizeStartRef.current.origW + dx);
      let newH = newW / aspectRatio;
      if (newH < 30) {
        newH = 30;
        newW = newH * aspectRatio;
      }

      onShapeUpdate(selectedId, {
        props: { ...shape.props, width: newW, height: newH },
      } as Partial<Shape>);
    }
  }, [selectedId, screenToPage, onShapeUpdate, shapes]);

  const handlePointerUp = useCallback(() => {
    modeRef.current = "none";
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
