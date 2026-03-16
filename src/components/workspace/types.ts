import type { BackgroundType } from "@/components/whiteboard/types";

export interface PageItem {
  id: string;
  title: string | null;
  sortOrder: number;
  backgroundType: BackgroundType;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  ownerId: string;
}
