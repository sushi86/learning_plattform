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
