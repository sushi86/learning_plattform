import { Group, Rect, Line } from "react-konva";
import { A4_WIDTH_PX, A4_HEIGHT_PX, LINE_SPACING_PX } from "../types";
import { useMemo } from "react";

export function KonvaLined() {
  const lines = useMemo(() => {
    const result: { y: number }[] = [];
    const topMargin = 113; // ~30mm from top
    for (let y = topMargin; y < A4_HEIGHT_PX; y += LINE_SPACING_PX) {
      result.push({ y });
    }
    return result;
  }, []);

  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={A4_WIDTH_PX} height={A4_HEIGHT_PX} fill="#ffffff" />
      {lines.map((l) => (
        <Line
          key={l.y}
          points={[0, l.y, A4_WIDTH_PX, l.y]}
          stroke="#bfdbfe"
          strokeWidth={0.7}
        />
      ))}
    </Group>
  );
}
