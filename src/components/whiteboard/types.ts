/**
 * Background types for the whiteboard canvas pages.
 * Maps to the Page.backgroundType enum in the database schema.
 */
export type BackgroundType = "BLANK" | "GRID" | "LINED" | "COORDINATE";

/**
 * A4 page dimensions in pixels (at 96 DPI).
 * 210mm × 297mm → 794px × 1123px
 */
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

/** Millimeters to pixels conversion factor at 96 DPI */
export const MM_TO_PX = 96 / 25.4; // ~3.78 px per mm

/** Grid spacing: 5mm in pixels */
export const GRID_SPACING_PX = 5 * MM_TO_PX; // ~18.9px

/** Lined spacing: 8mm in pixels */
export const LINE_SPACING_PX = 8 * MM_TO_PX; // ~30.24px

/** Coordinate system grid spacing: 10mm in pixels */
export const COORD_GRID_SPACING_PX = 10 * MM_TO_PX; // ~37.8px
