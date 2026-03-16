"use client";

import { useState, useRef, useCallback } from "react";
import type { PageItem } from "./types";

interface PageSidebarProps {
  pages: PageItem[];
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
  onReorder: (pages: { id: string; sortOrder: number }[]) => void;
  isTeacher: boolean;
  /** Map of pageId → thumbnail data URL, updated by the canvas */
  thumbnails?: Map<string, string>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const BACKGROUND_PREVIEWS: Record<string, React.ReactNode> = {
  BLANK: (
    <div className="h-full w-full rounded-sm bg-white" />
  ),
  GRID: (
    <div className="relative h-full w-full rounded-sm bg-white">
      <svg className="absolute inset-0 h-full w-full">
        {Array.from({ length: 5 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={((i + 1) * 100) / 6 + "%"}
            y1="0"
            x2={((i + 1) * 100) / 6 + "%"}
            y2="100%"
            stroke="#e0e0e0"
            strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <line
            key={`h${i}`}
            x1="0"
            y1={((i + 1) * 100) / 8 + "%"}
            x2="100%"
            y2={((i + 1) * 100) / 8 + "%"}
            stroke="#e0e0e0"
            strokeWidth="0.5"
          />
        ))}
      </svg>
    </div>
  ),
  LINED: (
    <div className="relative h-full w-full rounded-sm bg-white">
      <svg className="absolute inset-0 h-full w-full">
        {Array.from({ length: 6 }, (_, i) => (
          <line
            key={`h${i}`}
            x1="0"
            y1={((i + 1) * 100) / 7 + "%"}
            x2="100%"
            y2={((i + 1) * 100) / 7 + "%"}
            stroke="#c8d4e0"
            strokeWidth="0.5"
          />
        ))}
      </svg>
    </div>
  ),
  COORDINATE: (
    <div className="relative h-full w-full rounded-sm bg-white">
      <svg className="absolute inset-0 h-full w-full">
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#666" strokeWidth="0.75" />
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#666" strokeWidth="0.75" />
      </svg>
    </div>
  ),
};

/**
 * Calculate gap-based sortOrder values after a drag reorder.
 * Uses midpoint between neighbors; renumbers all if collision detected.
 */
function calculateReorderedSortOrders(
  pages: PageItem[],
  dragIndex: number,
  dropIndex: number,
): { id: string; sortOrder: number }[] {
  if (dragIndex === dropIndex) return [];

  const reordered = [...pages];
  const [moved] = reordered.splice(dragIndex, 1);
  reordered.splice(dropIndex, 0, moved);

  // Calculate new sortOrder for the moved item using gap-based approach
  const prevOrder = dropIndex > 0 ? reordered[dropIndex - 1].sortOrder : 0;
  const nextOrder =
    dropIndex < reordered.length - 1
      ? reordered[dropIndex + 1].sortOrder
      : prevOrder + 2000;

  const newOrder = Math.floor((prevOrder + nextOrder) / 2);

  // Check for collision (same sortOrder as a neighbor)
  if (newOrder === prevOrder || newOrder === nextOrder) {
    // Renumber all pages with 1000 gaps
    return reordered.map((page, index) => ({
      id: page.id,
      sortOrder: (index + 1) * 1000,
    }));
  }

  // Only update the moved item
  return [{ id: moved.id, sortOrder: newOrder }];
}

export default function PageSidebar({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onDeletePage,
  onReorder,
  isTeacher,
  thumbnails,
  collapsed = false,
  onToggleCollapse,
}: PageSidebarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
      setDragIndex(index);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropIndex(index);
    },
    [],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDropIndex(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      dragCounter.current = 0;
      const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);

      if (!isNaN(sourceIndex) && sourceIndex !== targetIndex) {
        const updates = calculateReorderedSortOrders(
          pages,
          sourceIndex,
          targetIndex,
        );
        if (updates.length > 0) {
          onReorder(updates);
        }
      }

      setDragIndex(null);
      setDropIndex(null);
    },
    [pages, onReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
    dragCounter.current = 0;
  }, []);

  if (collapsed) {
    return (
      <aside className="flex h-full w-10 flex-col border-r border-gray-200 bg-gray-50">
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
          title="Seitenleiste öffnen"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gray-200 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleCollapse}
            className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
            title="Seitenleiste minimieren"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Seiten
          </span>
        </div>
        <button
          onClick={onAddPage}
          className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
          title="Neue Seite"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </button>
      </div>

      {/* Page list */}
      <div className="flex-1 overflow-y-auto p-2">
        {pages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-xs text-gray-400">Noch keine Seiten</p>
            <button
              onClick={onAddPage}
              className="mt-2 text-xs font-medium text-violet-600 hover:text-violet-700"
            >
              Seite erstellen
            </button>
          </div>
        )}

        {pages.map((page, index) => (
          <div
            key={page.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelectPage(page.id)}
            className={`group relative mb-1.5 cursor-pointer rounded-lg border p-1.5 transition-all ${
              activePageId === page.id
                ? "border-violet-400 bg-violet-50 shadow-sm"
                : "border-transparent hover:border-gray-300 hover:bg-white"
            } ${
              dragIndex === index ? "opacity-40" : ""
            } ${
              dropIndex === index && dragIndex !== index
                ? "border-violet-300 bg-violet-50/50"
                : ""
            }`}
          >
            {/* Miniature preview */}
            <div className="mb-1 aspect-[3/4] w-full overflow-hidden rounded border border-gray-200">
              {thumbnails?.get(page.id) ? (
                <img
                  src={thumbnails.get(page.id)}
                  alt={page.title || `Seite ${index + 1}`}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                BACKGROUND_PREVIEWS[page.backgroundType] ||
                BACKGROUND_PREVIEWS.BLANK
              )}
            </div>

            {/* Page label */}
            <div className="flex items-center justify-between">
              <span className="truncate text-xs font-medium text-gray-700">
                {page.title || `Seite ${index + 1}`}
              </span>
              {isTeacher && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePage(page.id);
                  }}
                  className="ml-1 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  title="Seite löschen"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
