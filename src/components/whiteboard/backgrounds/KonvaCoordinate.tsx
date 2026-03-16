import { Group, Rect, Line, Text } from "react-konva";
import { A4_WIDTH_PX, A4_HEIGHT_PX, COORD_GRID_SPACING_PX } from "../types";
import { useMemo } from "react";

export function KonvaCoordinate() {
  const spacing = COORD_GRID_SPACING_PX;
  const originX = Math.round(A4_WIDTH_PX / 2);
  const originY = Math.round(A4_HEIGHT_PX / 2);

  const { gridLines, labels } = useMemo(() => {
    const gl: { points: number[]; key: string }[] = [];
    const lb: { x: number; y: number; text: string; key: string; align: string }[] = [];

    // Vertical grid lines
    for (let x = originX % spacing; x < A4_WIDTH_PX; x += spacing) {
      gl.push({ points: [x, 0, x, A4_HEIGHT_PX], key: `v${x}` });
    }
    // Horizontal grid lines
    for (let y = originY % spacing; y < A4_HEIGHT_PX; y += spacing) {
      gl.push({ points: [0, y, A4_WIDTH_PX, y], key: `h${y}` });
    }

    // X-axis labels
    for (let x = originX + spacing; x < A4_WIDTH_PX - 20; x += spacing * 2) {
      const value = Math.round((x - originX) / spacing);
      lb.push({ x, y: originY + 16, text: `${value}`, key: `xl${value}`, align: "center" });
    }
    for (let x = originX - spacing; x > 20; x -= spacing * 2) {
      const value = Math.round((x - originX) / spacing);
      lb.push({ x, y: originY + 16, text: `${value}`, key: `xl${value}`, align: "center" });
    }

    // Y-axis labels
    for (let y = originY - spacing; y > 20; y -= spacing * 2) {
      const value = Math.round((originY - y) / spacing);
      lb.push({ x: originX - 14, y: y - 5, text: `${value}`, key: `yl${value}`, align: "right" });
    }
    for (let y = originY + spacing; y < A4_HEIGHT_PX - 20; y += spacing * 2) {
      const value = Math.round((originY - y) / spacing);
      lb.push({ x: originX - 14, y: y - 5, text: `${value}`, key: `yl${value}`, align: "right" });
    }

    return { gridLines: gl, labels: lb };
  }, [originX, originY, spacing]);

  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={A4_WIDTH_PX} height={A4_HEIGHT_PX} fill="#ffffff" />
      {gridLines.map((l) => (
        <Line key={l.key} points={l.points} stroke="#e4e4e7" strokeWidth={0.5} />
      ))}
      <Line points={[0, originY, A4_WIDTH_PX, originY]} stroke="#18181b" strokeWidth={1.5} />
      <Line points={[originX, 0, originX, A4_HEIGHT_PX]} stroke="#18181b" strokeWidth={1.5} />
      <Text x={A4_WIDTH_PX - 20} y={originY - 20} text="x" fontSize={12} fontStyle="bold" fill="#18181b" />
      <Text x={originX + 10} y={4} text="y" fontSize={12} fontStyle="bold" fill="#18181b" />
      <Text x={originX - 14} y={originY + 6} text="0" fontSize={9} fill="#71717a" />
      {labels.map((l) => (
        <Text key={l.key} x={l.x} y={l.y} text={l.text} fontSize={9} fill="#71717a" align={l.align} />
      ))}
    </Group>
  );
}
