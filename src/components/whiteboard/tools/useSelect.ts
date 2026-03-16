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

type InteractionMode = "none" | "move" | "resize" | "rect-select";

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
    case "ai-step":
    case "ai-correction":
      return { x: shape.x, y: shape.y, w: 300, h: 80 };
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

/** Check if two rectangles overlap */
function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function useSelect({ shapes, onShapeUpdate, onShapeDelete, screenToPage }: UseSelectOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const modeRef = useRef<InteractionMode>("none");
  const dragOffsetRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const resizeStartRef = useRef({ mouseX: 0, mouseY: 0, origW: 0, origH: 0 });

  // Rectangle selection state
  const rectStartRef = useRef<{ x: number; y: number } | null>(null);
  const [rectPreview, setRectPreview] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Keep a single selectedId getter for backward compat
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;

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

    // Check if clicking a resize handle on a selected image shape
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
      if (selectedIds.has(hitId)) {
        // Clicked on an already-selected shape: start moving all selected
        modeRef.current = "move";
        const offsets = new Map<string, { x: number; y: number }>();
        for (const id of selectedIds) {
          const s = shapes.get(id);
          if (s) offsets.set(id, { x: pos.x - s.x, y: pos.y - s.y });
        }
        dragOffsetRef.current = offsets;
      } else {
        // Clicked on a new shape: select only this one
        setSelectedIds(new Set([hitId]));
        modeRef.current = "move";
        const shape = shapes.get(hitId)!;
        const offsets = new Map<string, { x: number; y: number }>();
        offsets.set(hitId, { x: pos.x - shape.x, y: pos.y - shape.y });
        dragOffsetRef.current = offsets;
      }
    } else {
      // Clicked on empty space: start rectangle selection
      setSelectedIds(new Set());
      modeRef.current = "rect-select";
      rectStartRef.current = pos;
      setRectPreview({ x: pos.x, y: pos.y, width: 0, height: 0 });
    }
  }, [hitTest, screenToPage, shapes, selectedId, selectedIds]);

  const handlePointerMove = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (modeRef.current === "none") return;
    const pos = screenToPage(e.evt.clientX, e.evt.clientY);

    if (modeRef.current === "rect-select" && rectStartRef.current) {
      const s = rectStartRef.current;
      setRectPreview({
        x: Math.min(s.x, pos.x),
        y: Math.min(s.y, pos.y),
        width: Math.abs(pos.x - s.x),
        height: Math.abs(pos.y - s.y),
      });
      return;
    }

    if (modeRef.current === "move") {
      for (const id of selectedIds) {
        const offset = dragOffsetRef.current.get(id);
        if (offset) {
          const newX = pos.x - offset.x;
          const newY = pos.y - offset.y;
          onShapeUpdate(id, { x: newX, y: newY });
        }
      }
    } else if (modeRef.current === "resize" && selectedId) {
      const shape = shapes.get(selectedId);
      if (!shape || shape.type !== "image") return;

      const dx = pos.x - resizeStartRef.current.mouseX;
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
  }, [selectedIds, selectedId, screenToPage, onShapeUpdate, shapes]);

  const handlePointerUp = useCallback(() => {
    if (modeRef.current === "rect-select" && rectPreview && rectStartRef.current) {
      const { x, y, width, height } = rectPreview;
      if (width > 5 && height > 5) {
        // Find all shapes that overlap with the selection rectangle
        const hits = new Set<string>();
        for (const [id, shape] of shapes.entries()) {
          const b = getShapeBounds(shape);
          if (rectsOverlap(x, y, width, height, b.x, b.y, b.w, b.h)) {
            hits.add(id);
          }
        }
        setSelectedIds(hits);
      }
      rectStartRef.current = null;
      setRectPreview(null);
    }
    modeRef.current = "none";
  }, [rectPreview, shapes]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (selectedIds.size > 0 && (e.key === "Delete" || e.key === "Backspace")) {
      for (const id of selectedIds) {
        onShapeDelete(id);
      }
      setSelectedIds(new Set());
    }
  }, [selectedIds, onShapeDelete]);

  return {
    selectedId,
    selectedIds,
    setSelectedId: (id: string | null) => setSelectedIds(id ? new Set([id]) : new Set()),
    setSelectedIds,
    rectPreview,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
  };
}
