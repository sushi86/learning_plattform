import type { AiStepShape, AiCorrectionShape } from "@/lib/ai/types";

/**
 * A4 page dimensions in pixels (at 96 DPI).
 * 210mm x 297mm → 794px x 1123px
 */
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

/** Millimeters to pixels conversion factor at 96 DPI */
export const MM_TO_PX = 96 / 25.4; // ~3.78 px per mm

/** Grid spacing: 5mm in pixels */
export const GRID_SPACING_PX = 5 * MM_TO_PX;

/** Lined spacing: 8mm in pixels */
export const LINE_SPACING_PX = 8 * MM_TO_PX;

/** Coordinate system grid spacing: 10mm in pixels */
export const COORD_GRID_SPACING_PX = 10 * MM_TO_PX;

/** Background types for the whiteboard canvas pages */
export type BackgroundType = "BLANK" | "GRID" | "LINED" | "COORDINATE";

/** Available tool types */
export type ToolType = "select" | "draw" | "eraser" | "text" | "line" | "rect-select" | "lasso-select";

/** Color palette */
export const COLORS = [
  "#18181b", // black
  "#dc2626", // red
  "#2563eb", // blue
  "#16a34a", // green
  "#ea580c", // orange
  "#9333ea", // purple
] as const;

/** Stroke width options */
export const STROKE_WIDTHS = [2, 4, 8] as const;

/** Shape type discriminator */
export type ShapeType = "draw" | "line" | "text" | "image" | "ai-step" | "ai-correction";

interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  color: string;
}

export interface DrawShape extends BaseShape {
  type: "draw";
  props: {
    points: number[];       // flat [x1,y1,x2,y2,...] relative to x,y
    pressures?: number[];   // pressure per point (0-1), length = points.length/2
    strokeWidth: number;
  };
}

export interface LineShape extends BaseShape {
  type: "line";
  props: {
    points: [number, number, number, number]; // [x1,y1,x2,y2] relative to x,y
    strokeWidth: number;
  };
}

export interface TextShape extends BaseShape {
  type: "text";
  props: {
    content: string;
    fontSize: number;
    width?: number;   // text area width for wrapping
  };
}

export interface ImageShape extends BaseShape {
  type: "image";
  props: {
    src: string;
    width: number;
    height: number;
  };
}

export type Shape = DrawShape | LineShape | TextShape | ImageShape | AiStepShape | AiCorrectionShape;

/** Clamp a point to A4 sheet bounds */
export function clampToSheet(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(A4_WIDTH_PX, x)),
    y: Math.max(0, Math.min(A4_HEIGHT_PX, y)),
  };
}

/** Check if a point is within A4 sheet bounds */
export function isInSheet(x: number, y: number): boolean {
  return x >= 0 && x <= A4_WIDTH_PX && y >= 0 && y <= A4_HEIGHT_PX;
}

/** Generate a unique shape ID */
export function createShapeId(): string {
  return crypto.randomUUID();
}
