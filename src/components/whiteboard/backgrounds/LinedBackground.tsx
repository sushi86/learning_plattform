"use client";

import type { ReactElement } from "react";
import { A4_WIDTH_PX, A4_HEIGHT_PX, LINE_SPACING_PX } from "../types";

export function LinedBackground() {
  const spacing = LINE_SPACING_PX;
  // Top margin before first line (approx 30mm)
  const topMargin = 113;

  const lines: ReactElement[] = [];
  for (let y = topMargin; y < A4_HEIGHT_PX; y += spacing) {
    lines.push(
      <line
        key={y}
        x1={0}
        y1={y}
        x2={A4_WIDTH_PX}
        y2={y}
        stroke="#bfdbfe"
        strokeWidth="0.7"
      />,
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }}
    >
      <svg
        width={A4_WIDTH_PX}
        height={A4_HEIGHT_PX}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100%" height="100%" fill="#ffffff" />
        {lines}
      </svg>
    </div>
  );
}
