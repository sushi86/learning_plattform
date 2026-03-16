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
