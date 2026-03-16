"use client";

import { useCallback } from "react";
import type Konva from "konva";
import type { Shape } from "../types";

interface UseEraserOptions {
  shapes: Map<string, Shape>;
  onShapeDelete: (id: string) => void;
  screenToPage: (x: number, y: number) => { x: number; y: number };
}

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
        return;
      }
    }
  }, [shapes, onShapeDelete, screenToPage]);

  return { handlePointerDown };
}
