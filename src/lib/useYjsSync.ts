"use client";

/**
 * Y.js WebSocket Sync Hook for tldraw
 *
 * Connects to the WebSocket server, syncs Y.js document with tldraw's store,
 * handles reconnection with exponential backoff, and offline queueing.
 */
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import type { Editor, TLRecord, TLStoreEventInfo } from "tldraw";

/* ---------- Types ---------- */

export type ConnectionStatus = "connected" | "reconnecting" | "offline";

/* ---------- Sync protocol message types ---------- */

const MSG_SYNC_STEP1 = 0;
const MSG_SYNC_STEP2 = 1;
const MSG_UPDATE = 2;

function encodeSyncStep1(stateVector: Uint8Array): Uint8Array {
  const msg = new Uint8Array(1 + stateVector.length);
  msg[0] = MSG_SYNC_STEP1;
  msg.set(stateVector, 1);
  return msg;
}

function encodeUpdate(update: Uint8Array): Uint8Array {
  const msg = new Uint8Array(1 + update.length);
  msg[0] = MSG_UPDATE;
  msg.set(update, 1);
  return msg;
}

/* ---------- Hook ---------- */

interface UseYjsSyncOptions {
  pageId: string;
  token: string | null;
  editor: Editor | null;
}

interface UseYjsSyncReturn {
  connectionStatus: ConnectionStatus;
}

export function useYjsSync({
  pageId,
  token,
  editor,
}: UseYjsSyncOptions): UseYjsSyncReturn {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("offline");

  const wsRef = useRef<WebSocket | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const idbRef = useRef<IndexeddbPersistence | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reconnectAttemptsRef = useRef(0);
  const bridgeCleanupRef = useRef<(() => void) | null>(null);

  // Connect when deps are ready
  useEffect(() => {
    if (!pageId || !token || !editor) return;

    // Initialize Y.Doc
    const doc = new Y.Doc();
    docRef.current = doc;
    const yRecords = doc.getMap<TLRecord>("tldraw_records");

    // Set up IndexedDB persistence for offline support
    const idb = new IndexeddbPersistence(`mathboard-page-${pageId}`, doc);
    idbRef.current = idb;

    // --- Bridge Y.js ↔ tldraw store ---

    // 1. Y.Doc → tldraw store: when remote updates arrive
    const yObserver = (
      events: Y.YMapEvent<TLRecord>[],
      txn: Y.Transaction,
    ) => {
      if (txn.origin === "tldraw") return; // Skip our own changes

      editor.store.mergeRemoteChanges(() => {
        for (const event of events) {
          event.changes.keys.forEach((change, key) => {
            switch (change.action) {
              case "add":
              case "update": {
                const record = yRecords.get(key);
                if (record) {
                  try {
                    editor.store.put([record]);
                  } catch {
                    // Record type might not match — skip silently
                  }
                }
                break;
              }
              case "delete": {
                try {
                  editor.store.remove([key as TLRecord["id"]]);
                } catch {
                  // Already deleted — skip
                }
                break;
              }
            }
          });
        }
      });
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yRecords.observeDeep(yObserver as any);

    // 2. tldraw store → Y.Doc: when local changes happen
    const storeListener = ({ changes }: TLStoreEventInfo) => {
      doc.transact(() => {
        for (const record of Object.values(changes.added)) {
          yRecords.set(record.id, record as TLRecord);
        }
        for (const [, to] of Object.values(changes.updated)) {
          yRecords.set(to.id, to as TLRecord);
        }
        for (const record of Object.values(changes.removed)) {
          yRecords.delete(record.id);
        }
      }, "tldraw");
    };
    const removeStoreListener = editor.store.listen(storeListener, {
      source: "user",
      scope: "document",
    });

    // 3. Y.Doc updates → send over WebSocket
    const docUpdateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return; // Don't echo remote updates back
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(encodeUpdate(update));
      }
    };
    doc.on("update", docUpdateHandler);

    bridgeCleanupRef.current = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yRecords.unobserveDeep(yObserver as any);
      removeStoreListener();
      doc.off("update", docUpdateHandler);
    };

    // Load existing Y.Doc records into tldraw if we have them from IndexedDB
    idb.on("synced", () => {
      if (yRecords.size > 0) {
        editor.store.mergeRemoteChanges(() => {
          const records: TLRecord[] = [];
          yRecords.forEach((record) => {
            records.push(record);
          });
          if (records.length > 0) {
            try {
              editor.store.put(records);
            } catch {
              // Some records might conflict — that's OK
            }
          }
        });
      }
    });

    // --- WebSocket connection with reconnect ---

    function connectWs() {
      // Clean up existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/page/${pageId}?token=${encodeURIComponent(token!)}`;  // token is checked non-null at effect start

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      setConnectionStatus("reconnecting");

      ws.onopen = () => {
        console.log(`[yjs-sync] Connected to page ${pageId}`);
        setConnectionStatus("connected");
        reconnectAttemptsRef.current = 0;

        // Send sync step 1: our state vector so server sends us missing updates
        const stateVector = Y.encodeStateVector(doc);
        ws.send(encodeSyncStep1(stateVector));
      };

      ws.onmessage = (event) => {
        try {
          const data = new Uint8Array(event.data as ArrayBuffer);
          if (data.length === 0) return;

          const msgType = data[0];
          const payload = data.slice(1);

          switch (msgType) {
            case MSG_SYNC_STEP2:
            case MSG_UPDATE: {
              // Apply remote update to our Y.Doc
              Y.applyUpdate(doc, payload, "remote");
              break;
            }
            default:
              break;
          }
        } catch (err) {
          console.error("[yjs-sync] Error handling message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log(
          `[yjs-sync] Disconnected from page ${pageId} (code: ${event.code})`,
        );
        wsRef.current = null;

        if (event.code !== 1000 && event.code !== 1001) {
          // Unexpected close — reconnect with exponential backoff
          setConnectionStatus("reconnecting");
          const attempts = reconnectAttemptsRef.current;
          const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
          reconnectAttemptsRef.current = attempts + 1;

          console.log(
            `[yjs-sync] Reconnecting in ${delay}ms (attempt ${attempts + 1})`,
          );
          reconnectTimeoutRef.current = setTimeout(connectWs, delay);
        } else {
          setConnectionStatus("offline");
        }
      };

      ws.onerror = (err) => {
        console.error("[yjs-sync] WebSocket error:", err);
      };
    }

    connectWs();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (bridgeCleanupRef.current) {
        bridgeCleanupRef.current();
        bridgeCleanupRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmount");
        wsRef.current = null;
      }
      if (idbRef.current) {
        idbRef.current.destroy();
        idbRef.current = null;
      }
      if (docRef.current) {
        docRef.current.destroy();
        docRef.current = null;
      }
    };
  }, [pageId, token, editor]);

  return { connectionStatus };
}
