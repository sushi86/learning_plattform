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
  const [drawing, setDrawing] = useState(false);
  const [preview, setPreview] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      const pos = screenToPage(e.evt.clientX, e.evt.clientY);
      startRef.current = pos;
      setDrawing(true);
      setSelection(null);
      setPreview({ x: pos.x, y: pos.y, width: 0, height: 0 });
    },
    [screenToPage],
  );

  const handlePointerMove = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!startRef.current) return;
      const cur = screenToPage(e.evt.clientX, e.evt.clientY);
      const s = startRef.current;
      setPreview({
        x: Math.min(s.x, cur.x),
        y: Math.min(s.y, cur.y),
        width: Math.abs(cur.x - s.x),
        height: Math.abs(cur.y - s.y),
      });
    },
    [screenToPage],
  );

  const handlePointerUp = useCallback(() => {
    if (!startRef.current || !preview) {
      setDrawing(false);
      setPreview(null);
      return;
    }
    const { x, y, width, height } = preview;
    if (width > 10 && height > 10) {
      setSelection({
        points: [x, y, x + width, y, x + width, y + height, x, y + height],
        bounds: { x, y, width, height },
      });
    }
    startRef.current = null;
    setDrawing(false);
    setPreview(null);
  }, [preview]);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  return {
    selection,
    drawing,
    preview,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    clearSelection,
  };
}
