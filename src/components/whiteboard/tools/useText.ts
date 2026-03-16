"use client";

import { useCallback, useRef, useState } from "react";
import type Konva from "konva";
import { type TextShape, clampToSheet, createShapeId, isInSheet } from "../types";

interface UseTextOptions {
  color: string;
  fontSize: number;
  onShapeAdd: (shape: TextShape) => void;
  screenToPage: (x: number, y: number) => { x: number; y: number };
  scale: number;
  stageOffset: { x: number; y: number };
}

export interface TextEditState {
  active: boolean;
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  content: string;
}

export function useText({ color, fontSize, onShapeAdd, screenToPage, scale, stageOffset }: UseTextOptions) {
  const [editState, setEditState] = useState<TextEditState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const commitText = useCallback(() => {
    if (!editState || !editState.content.trim()) {
      setEditState(null);
      return;
    }

    const shape: TextShape = {
      id: createShapeId(),
      type: "text",
      x: editState.x,
      y: editState.y,
      color,
      props: {
        content: editState.content,
        fontSize,
      },
    };

    onShapeAdd(shape);
    setEditState(null);
  }, [editState, color, fontSize, onShapeAdd]);

  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (editState) {
      commitText();
    }

    const pos = screenToPage(e.evt.clientX, e.evt.clientY);
    if (!isInSheet(pos.x, pos.y)) return;

    const clamped = clampToSheet(pos.x, pos.y);

    const screenX = clamped.x * scale + stageOffset.x;
    const screenY = clamped.y * scale + stageOffset.y;

    setEditState({
      active: true,
      x: clamped.x,
      y: clamped.y,
      screenX,
      screenY,
      content: "",
    });

    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [editState, commitText, screenToPage, scale, stageOffset]);

  const handleTextChange = useCallback((content: string) => {
    setEditState((prev) => prev ? { ...prev, content } : null);
  }, []);

  const handleTextKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setEditState(null);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitText();
    }
  }, [commitText]);

  return {
    editState,
    textareaRef,
    handlePointerDown,
    commitText,
    handleTextChange,
    handleTextKeyDown,
  };
}
