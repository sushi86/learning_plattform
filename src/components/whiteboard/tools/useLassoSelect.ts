import { useCallback, useRef, useState } from "react";
import type Konva from "konva";
import type { AiSelection } from "./useRectSelect";

interface UseLassoSelectOptions {
  screenToPage: (x: number, y: number) => { x: number; y: number };
}

export function useLassoSelect({ screenToPage }: UseLassoSelectOptions) {
  const [selection, setSelection] = useState<AiSelection | null>(null);
  const pointsRef = useRef<number[]>([]);
  const [drawing, setDrawing] = useState(false);

  const handlePointerDown = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      const pos = screenToPage(e.evt.clientX, e.evt.clientY);
      pointsRef.current = [pos.x, pos.y];
      setDrawing(true);
      setSelection(null);
    },
    [screenToPage],
  );

  const handlePointerMove = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!drawing) return;
      const pos = screenToPage(e.evt.clientX, e.evt.clientY);
      pointsRef.current.push(pos.x, pos.y);
    },
    [screenToPage, drawing],
  );

  const handlePointerUp = useCallback(() => {
    if (pointsRef.current.length < 6) {
      pointsRef.current = [];
      setDrawing(false);
      return;
    }
    const pts = pointsRef.current;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i]);
      minY = Math.min(minY, pts[i + 1]);
      maxX = Math.max(maxX, pts[i]);
      maxY = Math.max(maxY, pts[i + 1]);
    }
    const width = maxX - minX;
    const height = maxY - minY;
    if (width > 10 && height > 10) {
      setSelection({
        points: [...pts],
        bounds: { x: minX, y: minY, width, height },
      });
    }
    pointsRef.current = [];
    setDrawing(false);
  }, [drawing]);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  return {
    selection,
    drawing,
    pointsRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    clearSelection,
  };
}
