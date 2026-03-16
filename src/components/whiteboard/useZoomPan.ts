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
  containerWidth: number;
  containerHeight: number;
  pageWidth: number;
  pageHeight: number;
}

export function useZoomPan({ containerWidth, containerHeight, pageWidth, pageHeight }: UseZoomPanOptions) {
  const [state, setState] = useState<ZoomPanState>(() => {
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

  const stateRef = useRef(state);
  stateRef.current = state;

  const isPanningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const spaceDownRef = useRef(false);

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

    const mousePointTo = {
      x: (pointer.x - s.x) / oldScale,
      y: (pointer.y - s.y) / oldScale,
    };

    setState({
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, []);

  const screenToPage = useCallback((screenX: number, screenY: number) => {
    const s = stateRef.current;
    return {
      x: (screenX - s.x) / s.scale,
      y: (screenY - s.y) / s.scale,
    };
  }, []);

  const startPan = useCallback((screenX: number, screenY: number) => {
    isPanningRef.current = true;
    lastPointerRef.current = { x: screenX, y: screenY };
  }, []);

  const movePan = useCallback((screenX: number, screenY: number) => {
    if (!isPanningRef.current) return;
    const dx = screenX - lastPointerRef.current.x;
    const dy = screenY - lastPointerRef.current.y;
    lastPointerRef.current = { x: screenX, y: screenY };
    setState((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

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
