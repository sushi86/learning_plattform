"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useYjsSync, type ConnectionStatus } from "@/lib/useYjsSync";
import { useWsToken } from "@/lib/useWsToken";
import { FileUploadButton } from "./FileUploadButton";

/* ---------- Background mapping ---------- */

const BACKGROUND_COMPONENTS: Record<BackgroundType, React.ComponentType> = {
  BLANK: BlankBackground,
  GRID: GridBackground,
  LINED: LinedBackground,
  COORDINATE: CoordinateBackground,
};

/* ---------- Custom toolbar ---------- */

function CustomToolbarContent({ pageId }: { pageId?: string }) {
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
      {pageId && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderLeft: "1px solid var(--color-muted-2, #e0e0e0)",
            marginLeft: 4,
            paddingLeft: 4,
          }}
        >
          <FileUploadButton pageId={pageId} />
        </div>
      )}
    </>
  );
}

/* ---------- Props ---------- */

export interface WhiteboardCanvasProps {
  /** Background pattern for the canvas page */
  backgroundType?: BackgroundType;
  /** Page ID for real-time sync and file upload association */
  pageId?: string;
  /** Callback when the editor instance is created */
  onMount?: (editor: Editor) => void;
  /** Callback when connection status changes */
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  /** Additional CSS class for the container */
  className?: string;
}

/* ---------- Component ---------- */

export function WhiteboardCanvas({
  backgroundType = "BLANK",
  pageId,
  onMount,
  onConnectionStatusChange,
  className,
}: WhiteboardCanvasProps) {
  const BackgroundComponent = BACKGROUND_COMPONENTS[backgroundType];
  const [editor, setEditor] = useState<Editor | null>(null);
  const wsToken = useWsToken();

  // Y.js sync hook — only active when pageId and token are available
  const { connectionStatus } = useYjsSync({
    pageId: pageId || "",
    token: wsToken,
    editor,
  });

  // Notify parent of connection status changes
  useEffect(() => {
    onConnectionStatusChange?.(connectionStatus);
  }, [connectionStatus, onConnectionStatusChange]);

  const components = useMemo<TLComponents>(
    () => ({
      Background: BackgroundComponent,
      Toolbar: () => (
        <DefaultToolbar>
          <CustomToolbarContent pageId={pageId} />
        </DefaultToolbar>
      ),
      // Hide UI elements not needed for MVP
      HelpMenu: null,
      MainMenu: null,
      PageMenu: null,
      NavigationPanel: null,
      MenuPanel: null,
    }),
    [BackgroundComponent, pageId],
  );

  const handleMount = useCallback(
    (editor: Editor) => {
      // Center the camera on the A4 page area
      editor.zoomToFit();
      setEditor(editor);
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
