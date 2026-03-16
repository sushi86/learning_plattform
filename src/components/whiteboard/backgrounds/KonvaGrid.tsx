import { Group, Rect, Line } from "react-konva";
import { A4_WIDTH_PX, A4_HEIGHT_PX, GRID_SPACING_PX } from "../types";
import { useMemo } from "react";

export function KonvaGrid() {
  const lines = useMemo(() => {
    const result: { points: number[]; key: string }[] = [];
    const s = GRID_SPACING_PX;

    // Vertical lines
    for (let x = s; x < A4_WIDTH_PX; x += s) {
      result.push({ points: [x, 0, x, A4_HEIGHT_PX], key: `v${x}` });
    }
    // Horizontal lines
    for (let y = s; y < A4_HEIGHT_PX; y += s) {
      result.push({ points: [0, y, A4_WIDTH_PX, y], key: `h${y}` });
    }
    return result;
  }, []);

  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={A4_WIDTH_PX} height={A4_HEIGHT_PX} fill="#ffffff" />
      {lines.map((l) => (
        <Line key={l.key} points={l.points} stroke="#d4d4d8" strokeWidth={0.5} />
      ))}
    </Group>
  );
}
