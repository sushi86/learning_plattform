import { Rect } from "react-konva";
import { A4_WIDTH_PX, A4_HEIGHT_PX } from "../types";

export function KonvaBlank() {
  return (
    <Rect
      x={0}
      y={0}
      width={A4_WIDTH_PX}
      height={A4_HEIGHT_PX}
      fill="#ffffff"
      listening={false}
    />
  );
}
