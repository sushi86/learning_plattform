"use client";

import { useCallback, useMemo } from "react";
import {
  Tldraw,
  DefaultToolbar,
  SelectToolbarItem,
  HandToolbarItem,
  DrawToolbarItem,
  EraserToolbarItem,
  TextToolbarItem,
  ArrowToolbarItem,
  LineToolbarItem,
  RectangleToolbarItem,
  EllipseToolbarItem,
  type Editor,
  type TLComponents,
} from "tldraw";
import "tldraw/tldraw.css";

import { BackgroundType, A4_WIDTH_PX, A4_HEIGHT_PX } from "./types";
import {
  BlankBackground,
  GridBackground,
  LinedBackground,
  CoordinateBackground,
} from "./backgrounds";

/* ---------- Background mapping ---------- */

const BACKGROUND_COMPONENTS: Record<BackgroundType, React.ComponentType> = {
  BLANK: BlankBackground,
  GRID: GridBackground,
  LINED: LinedBackground,
  COORDINATE: CoordinateBackground,
};

/* ---------- Custom toolbar ---------- */

function CustomToolbarContent() {
  return (
    <>
      <SelectToolbarItem />
      <HandToolbarItem />
      <DrawToolbarItem />
      <EraserToolbarItem />
      <TextToolbarItem />
      <LineToolbarItem />
      <ArrowToolbarItem />
      <RectangleToolbarItem />
      <EllipseToolbarItem />
    </>
  );
}

function CustomToolbar() {
  return (
    <DefaultToolbar>
      <CustomToolbarContent />
    </DefaultToolbar>
  );
}

/* ---------- Props ---------- */

export interface WhiteboardCanvasProps {
  /** Background pattern for the canvas page */
  backgroundType?: BackgroundType;
  /** Callback when the editor instance is created */
  onMount?: (editor: Editor) => void;
  /** Additional CSS class for the container */
  className?: string;
}

/* ---------- Component ---------- */

export function WhiteboardCanvas({
  backgroundType = "BLANK",
  onMount,
  className,
}: WhiteboardCanvasProps) {
  const BackgroundComponent = BACKGROUND_COMPONENTS[backgroundType];

  const components = useMemo<TLComponents>(
    () => ({
      Background: BackgroundComponent,
      Toolbar: CustomToolbar,
      // Hide UI elements not needed for MVP
      HelpMenu: null,
      MainMenu: null,
      PageMenu: null,
      NavigationPanel: null,
      MenuPanel: null,
    }),
    [BackgroundComponent],
  );

  const handleMount = useCallback(
    (editor: Editor) => {
      // Center the camera on the A4 page area
      editor.zoomToFit();

      onMount?.(editor);
    },
    [onMount],
  );

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <Tldraw
        components={components}
        onMount={handleMount}
        inferDarkMode={false}
        acceptedImageMimeTypes={["image/png", "image/jpeg", "image/webp"]}
        maxImageDimension={4096}
      />
    </div>
  );
}
