"use client";

import { A4_WIDTH_PX, A4_HEIGHT_PX } from "../types";

export function BlankBackground() {
  return (
    <div
      style={{
        position: "absolute",
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }}
    />
  );
}
