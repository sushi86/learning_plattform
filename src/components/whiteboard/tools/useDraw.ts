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
    pointsRef.current = [0, 0];
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

    if (pointsRef.current.length < 4) return;

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
