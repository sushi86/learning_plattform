import { useCallback, useRef, useState } from "react";
import type Konva from "konva";

export interface AiSelection {
  points: number[];
  bounds: { x: number; y: number; width: number; height: number };
}

interface UseRectSelectOptions {
  screenToPage: (x: number, y: number) => { x: number; y: number };
}

export function useRectSelect({ screenToPage }: UseRectSelectOptions) {
  const [selection, setSelection] = useState<AiSelection | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const currentRef = useRef<{ x: number; y: number } | null>(null);
  const [drawing, setDrawing] = useState(false);

  const handlePointerDown = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      const pos = screenToPage(e.evt.clientX, e.evt.clientY);
      startRef.current = pos;
      currentRef.current = pos;
      setDrawing(true);
      setSelection(null);
    },
    [screenToPage],
  );

  const handlePointerMove = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!startRef.current) return;
      currentRef.current = screenToPage(e.evt.clientX, e.evt.clientY);
    },
    [screenToPage],
  );

  const handlePointerUp = useCallback(() => {
    if (!startRef.current || !currentRef.current) return;
    const s = startRef.current;
    const c = currentRef.current;
    const x = Math.min(s.x, c.x);
    const y = Math.min(s.y, c.y);
    const width = Math.abs(c.x - s.x);
    const height = Math.abs(c.y - s.y);
    if (width > 10 && height > 10) {
      setSelection({
        points: [x, y, x + width, y, x + width, y + height, x, y + height],
        bounds: { x, y, width, height },
      });
    }
    startRef.current = null;
    currentRef.current = null;
    setDrawing(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  return {
    selection,
    drawing,
    startRef,
    currentRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    clearSelection,
  };
}
