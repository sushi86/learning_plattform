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
  /** Ref to the container element — needed to calculate offset from viewport */
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Start with a safe default — fitToPage() will be called once container size is known
  const [state, setState] = useState<ZoomPanState>({
    scale: 1,
    x: 0,
    y: 0,
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
    const s = stateRef.current;

    // Mac trackpad: ctrlKey = pinch-to-zoom, no ctrlKey = two-finger pan
    // Mouse: wheel = zoom
    if (e.evt.ctrlKey) {
      // Pinch-to-zoom (Mac trackpad) — deltaY is zoom amount
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const oldScale = s.scale;
      // Pinch deltaY is inverted and smaller, so use a gentler factor
      const zoomFactor = 1 - e.evt.deltaY * 0.01;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale * zoomFactor));

      const mousePointTo = {
        x: (pointer.x - s.x) / oldScale,
        y: (pointer.y - s.y) / oldScale,
      };

      setState({
        scale: newScale,
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    } else if (Math.abs(e.evt.deltaX) > 0 || Math.abs(e.evt.deltaY) > 0) {
      // Two-finger drag (Mac trackpad) or mousewheel — pan
      setState({
        ...s,
        x: s.x - e.evt.deltaX,
        y: s.y - e.evt.deltaY,
      });
    }
  }, []);

  const screenToPage = useCallback((screenX: number, screenY: number) => {
    const s = stateRef.current;
    // Subtract container's viewport offset so clientX/clientY map correctly
    const rect = containerRef.current?.getBoundingClientRect();
    const offsetX = rect?.left ?? 0;
    const offsetY = rect?.top ?? 0;
    return {
      x: (screenX - offsetX - s.x) / s.scale,
      y: (screenY - offsetY - s.y) / s.scale,
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
    containerRef,
  };
}
