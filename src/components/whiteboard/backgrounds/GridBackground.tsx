"use client";

import { A4_WIDTH_PX, A4_HEIGHT_PX, GRID_SPACING_PX } from "../types";

export function GridBackground() {
  const spacing = GRID_SPACING_PX;

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
        <defs>
          <pattern
            id="grid-5mm"
            width={spacing}
            height={spacing}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${spacing} 0 L 0 0 0 ${spacing}`}
              fill="none"
              stroke="#d4d4d8"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-5mm)" />
      </svg>
    </div>
  );
}
