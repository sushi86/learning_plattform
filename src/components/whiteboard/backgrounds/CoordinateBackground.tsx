"use client";

import type { ReactElement } from "react";
import { A4_WIDTH_PX, A4_HEIGHT_PX, COORD_GRID_SPACING_PX } from "../types";

export function CoordinateBackground() {
  const spacing = COORD_GRID_SPACING_PX;

  // Center the coordinate system on the page
  const originX = Math.round(A4_WIDTH_PX / 2);
  const originY = Math.round(A4_HEIGHT_PX / 2);

  // Grid lines
  const gridLines: ReactElement[] = [];
  let key = 0;

  // Vertical grid lines
  for (let x = originX % spacing; x < A4_WIDTH_PX; x += spacing) {
    gridLines.push(
      <line
        key={key++}
        x1={x}
        y1={0}
        x2={x}
        y2={A4_HEIGHT_PX}
        stroke="#e4e4e7"
        strokeWidth="0.5"
      />,
    );
  }

  // Horizontal grid lines
  for (let y = originY % spacing; y < A4_HEIGHT_PX; y += spacing) {
    gridLines.push(
      <line
        key={key++}
        x1={0}
        y1={y}
        x2={A4_WIDTH_PX}
        y2={y}
        stroke="#e4e4e7"
        strokeWidth="0.5"
      />,
    );
  }

  // Axis labels
  const labels: ReactElement[] = [];
  const labelOffset = 12;

  // X-axis labels (distance from origin in grid units)
  for (let x = originX + spacing; x < A4_WIDTH_PX - 20; x += spacing * 2) {
    const value = Math.round((x - originX) / spacing);
    labels.push(
      <text
        key={`xl-${value}`}
        x={x}
        y={originY + labelOffset + 4}
        textAnchor="middle"
        fontSize="9"
        fill="#71717a"
        fontFamily="sans-serif"
      >
        {value}
      </text>,
    );
  }
  for (let x = originX - spacing; x > 20; x -= spacing * 2) {
    const value = Math.round((x - originX) / spacing);
    labels.push(
      <text
        key={`xl-${value}`}
        x={x}
        y={originY + labelOffset + 4}
        textAnchor="middle"
        fontSize="9"
        fill="#71717a"
        fontFamily="sans-serif"
      >
        {value}
      </text>,
    );
  }

  // Y-axis labels (inverted because SVG y-axis goes down)
  for (let y = originY - spacing; y > 20; y -= spacing * 2) {
    const value = Math.round((originY - y) / spacing);
    labels.push(
      <text
        key={`yl-${value}`}
        x={originX - labelOffset}
        y={y + 3}
        textAnchor="end"
        fontSize="9"
        fill="#71717a"
        fontFamily="sans-serif"
      >
        {value}
      </text>,
    );
  }
  for (let y = originY + spacing; y < A4_HEIGHT_PX - 20; y += spacing * 2) {
    const value = Math.round((originY - y) / spacing);
    labels.push(
      <text
        key={`yl-${value}`}
        x={originX - labelOffset}
        y={y + 3}
        textAnchor="end"
        fontSize="9"
        fill="#71717a"
        fontFamily="sans-serif"
      >
        {value}
      </text>,
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

        {/* Grid lines */}
        {gridLines}

        {/* X-axis */}
        <line
          x1={0}
          y1={originY}
          x2={A4_WIDTH_PX}
          y2={originY}
          stroke="#18181b"
          strokeWidth="1.5"
        />
        {/* X-axis arrow */}
        <polygon
          points={`${A4_WIDTH_PX - 8},${originY - 4} ${A4_WIDTH_PX},${originY} ${A4_WIDTH_PX - 8},${originY + 4}`}
          fill="#18181b"
        />

        {/* Y-axis */}
        <line
          x1={originX}
          y1={0}
          x2={originX}
          y2={A4_HEIGHT_PX}
          stroke="#18181b"
          strokeWidth="1.5"
        />
        {/* Y-axis arrow (pointing up) */}
        <polygon
          points={`${originX - 4},8 ${originX},0 ${originX + 4},8`}
          fill="#18181b"
        />

        {/* Axis labels */}
        <text
          x={A4_WIDTH_PX - 16}
          y={originY - 10}
          fontSize="12"
          fontWeight="bold"
          fill="#18181b"
          fontFamily="sans-serif"
        >
          x
        </text>
        <text
          x={originX + 10}
          y={18}
          fontSize="12"
          fontWeight="bold"
          fill="#18181b"
          fontFamily="sans-serif"
        >
          y
        </text>

        {/* Origin label */}
        <text
          x={originX - 12}
          y={originY + 16}
          fontSize="9"
          fill="#71717a"
          fontFamily="sans-serif"
        >
          0
        </text>

        {/* Numeric labels */}
        {labels}
      </svg>
    </div>
  );
}
