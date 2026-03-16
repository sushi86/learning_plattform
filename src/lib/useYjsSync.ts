"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import type { Shape } from "@/components/whiteboard/types";

export type ConnectionStatus = "connected" | "reconnecting" | "offline";

/* --- Sync protocol --- */
const MSG_SYNC_STEP1 = 0;
const MSG_SYNC_STEP2 = 1;
const MSG_UPDATE = 2;

function encodeSyncStep1(sv: Uint8Array): Uint8Array {
  const msg = new Uint8Array(1 + sv.length);
  msg[0] = MSG_SYNC_STEP1;
  msg.set(sv, 1);
  return msg;
}

function encodeUpdate(update: Uint8Array): Uint8Array {
  const msg = new Uint8Array(1 + update.length);
  msg[0] = MSG_UPDATE;
  msg.set(update, 1);
  return msg;
}

/* --- Hook --- */

interface UseYjsSyncOptions {
  pageId: string;
  token: string | null;
}

interface UseYjsSyncReturn {
  connectionStatus: ConnectionStatus;
  shapes: Map<string, Shape>;
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useYjsSync({ pageId, token }: UseYjsSyncOptions): UseYjsSyncReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("offline");
  const [shapes, setShapes] = useState<Map<string, Shape>>(new Map());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const docRef = useRef<Y.Doc | null>(null);
  const yShapesRef = useRef<Y.Map<Shape> | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const idbRef = useRef<IndexeddbPersistence | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Sync Y.Map state to React state
  const syncToReact = useCallback(() => {
    const yShapes = yShapesRef.current;
    if (!yShapes) return;
    const map = new Map<string, Shape>();
    yShapes.forEach((val, key) => map.set(key, val));
    setShapes(map);
  }, []);

  const updateUndoState = useCallback(() => {
    const um = undoManagerRef.current;
    if (um) {
      setCanUndo(um.undoStack.length > 0);
      setCanRedo(um.redoStack.length > 0);
    }
  }, []);

  // Initialize Y.Doc and connect
  useEffect(() => {
    if (!pageId || !token) return;

    const doc = new Y.Doc();
    docRef.current = doc;
    const yShapes = doc.getMap<Shape>("shapes");
    yShapesRef.current = yShapes;

    // Undo manager
    const undoManager = new Y.UndoManager(yShapes);
    undoManagerRef.current = undoManager;
    undoManager.on("stack-item-added", updateUndoState);
    undoManager.on("stack-item-popped", updateUndoState);

    // IndexedDB persistence
    const idb = new IndexeddbPersistence(`mathboard-page-${pageId}`, doc);
    idbRef.current = idb;

    // Observe Y.Map changes → update React state
    const observer = () => syncToReact();
    yShapes.observeDeep(observer);

    // Load from IDB
    idb.on("synced", () => syncToReact());

    // Y.Doc updates → send over WebSocket
    const docUpdateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(encodeUpdate(update));
      }
    };
    doc.on("update", docUpdateHandler);

    // --- WebSocket ---
    function connectWs() {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/page/${pageId}?token=${encodeURIComponent(token!)}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      setConnectionStatus("reconnecting");

      ws.onopen = () => {
        console.log(`[yjs-sync] Connected to page ${pageId}`);
        setConnectionStatus("connected");
        reconnectAttemptsRef.current = 0;
        const sv = Y.encodeStateVector(doc);
        ws.send(encodeSyncStep1(sv));
      };

      ws.onmessage = (event) => {
        try {
          const data = new Uint8Array(event.data as ArrayBuffer);
          if (data.length === 0) return;
          const msgType = data[0];
          const payload = data.slice(1);
          if (msgType === MSG_SYNC_STEP2 || msgType === MSG_UPDATE) {
            Y.applyUpdate(doc, payload, "remote");
          }
        } catch (err) {
          console.error("[yjs-sync] Error handling message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log(`[yjs-sync] Disconnected (code: ${event.code})`);
        wsRef.current = null;
        if (event.code !== 1000 && event.code !== 1001) {
          setConnectionStatus("reconnecting");
          const attempts = reconnectAttemptsRef.current;
          const delay = Math.min(1000 * 2 ** attempts, 30000);
          reconnectAttemptsRef.current = attempts + 1;
          reconnectTimeoutRef.current = setTimeout(connectWs, delay);
        } else {
          setConnectionStatus("offline");
        }
      };

      ws.onerror = (err) => console.error("[yjs-sync] WebSocket error:", err);
    }

    connectWs();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      yShapes.unobserveDeep(observer);
      doc.off("update", docUpdateHandler);
      undoManager.destroy();
      if (wsRef.current) { wsRef.current.close(1000); wsRef.current = null; }
      if (idbRef.current) { idbRef.current.destroy(); idbRef.current = null; }
      doc.destroy();
      docRef.current = null;
      yShapesRef.current = null;
      undoManagerRef.current = null;
    };
  }, [pageId, token, syncToReact, updateUndoState]);

  // Mutators
  const addShape = useCallback((shape: Shape) => {
    yShapesRef.current?.set(shape.id, shape);
  }, []);

  const updateShape = useCallback((id: string, updates: Partial<Shape>) => {
    const yShapes = yShapesRef.current;
    if (!yShapes) return;
    const existing = yShapes.get(id);
    if (existing) {
      yShapes.set(id, { ...existing, ...updates } as Shape);
    }
  }, []);

  const deleteShape = useCallback((id: string) => {
    yShapesRef.current?.delete(id);
  }, []);

  const undo = useCallback(() => undoManagerRef.current?.undo(), []);
  const redo = useCallback(() => undoManagerRef.current?.redo(), []);

  return { connectionStatus, shapes, addShape, updateShape, deleteShape, undo, redo, canUndo, canRedo };
}
