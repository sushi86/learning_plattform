/**
 * Y.js Room Manager
 *
 * Manages Y.Doc instances per page, handles persistence to PostgreSQL,
 * and broadcasts updates to connected WebSocket clients.
 */
import * as Y from "yjs";
import type { WebSocket } from "ws";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/* ---------- Types ---------- */

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  userName: string;
}

interface Room {
  doc: Y.Doc;
  clients: Map<WebSocket, ConnectedClient>;
  persistTimer: ReturnType<typeof setInterval> | null;
  snapshotTimer: ReturnType<typeof setInterval> | null;
  lastPersist: number;
}

/* ---------- Prisma (standalone for server context) ---------- */

function createPrisma() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

const prisma = createPrisma();

/* ---------- Room store ---------- */

const rooms = new Map<string, Room>();

/* ---------- Encoding helpers ---------- */

/**
 * Y.js sync protocol message types.
 * We implement a simplified sync protocol:
 *   0 = sync step 1 (client sends state vector)
 *   1 = sync step 2 (server responds with diff)
 *   2 = update (incremental changes)
 *   3 = awareness (user presence — future use)
 */
const MSG_SYNC_STEP1 = 0;
const MSG_SYNC_STEP2 = 1;
const MSG_UPDATE = 2;

function encodeSyncStep2(update: Uint8Array): Uint8Array {
  const msg = new Uint8Array(1 + update.length);
  msg[0] = MSG_SYNC_STEP2;
  msg.set(update, 1);
  return msg;
}

function encodeUpdate(update: Uint8Array): Uint8Array {
  const msg = new Uint8Array(1 + update.length);
  msg[0] = MSG_UPDATE;
  msg.set(update, 1);
  return msg;
}

/* ---------- Room lifecycle ---------- */

async function loadDocFromDB(pageId: string): Promise<Uint8Array | null> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { yDocState: true },
  });
  if (page?.yDocState) {
    return Buffer.from(page.yDocState);
  }
  return null;
}

async function persistDoc(pageId: string, doc: Y.Doc): Promise<void> {
  const state = Y.encodeStateAsUpdate(doc);
  try {
    await prisma.page.update({
      where: { id: pageId },
      data: {
        yDocState: Buffer.from(state),
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(`[yjs-rooms] Failed to persist doc for page ${pageId}:`, err);
  }
}

async function persistCanvasSnapshot(
  pageId: string,
  doc: Y.Doc,
): Promise<void> {
  try {
    // Extract the tldraw records from the Y.Map and build a snapshot
    const yRecords = doc.getMap("tldraw_records");
    const records: Record<string, unknown> = {};
    yRecords.forEach((value, key) => {
      records[key] = value;
    });

    await prisma.page.update({
      where: { id: pageId },
      data: {
        canvasState: JSON.parse(JSON.stringify(records)),
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(
      `[yjs-rooms] Failed to persist canvas snapshot for page ${pageId}:`,
      err,
    );
  }
}

async function getOrCreateRoom(pageId: string): Promise<Room> {
  const existing = rooms.get(pageId);
  if (existing) return existing;

  const doc = new Y.Doc();

  // Load persisted state from DB
  const savedState = await loadDocFromDB(pageId);
  if (savedState) {
    Y.applyUpdate(doc, savedState);
  }

  // Periodic persistence every 30s
  const persistTimer = setInterval(
    () => {
      const room = rooms.get(pageId);
      if (room && room.clients.size > 0) {
        persistDoc(pageId, doc);
      }
    },
    30 * 1000,
  );

  // Periodic canvas snapshot every 60s
  const snapshotTimer = setInterval(
    () => {
      const room = rooms.get(pageId);
      if (room && room.clients.size > 0) {
        persistCanvasSnapshot(pageId, doc);
      }
    },
    60 * 1000,
  );

  const room: Room = {
    doc,
    clients: new Map(),
    persistTimer,
    snapshotTimer,
    lastPersist: Date.now(),
  };

  rooms.set(pageId, room);
  return room;
}

function destroyRoom(pageId: string): void {
  const room = rooms.get(pageId);
  if (!room) return;

  if (room.persistTimer) clearInterval(room.persistTimer);
  if (room.snapshotTimer) clearInterval(room.snapshotTimer);
  room.doc.destroy();
  rooms.delete(pageId);
}

/* ---------- Client connection handling ---------- */

export async function handleConnection(
  ws: WebSocket,
  pageId: string,
  userId: string,
  userName: string,
): Promise<void> {
  const room = await getOrCreateRoom(pageId);

  const client: ConnectedClient = { ws, userId, userName };
  room.clients.set(ws, client);

  console.log(
    `[yjs-rooms] Client ${userName} (${userId}) connected to page ${pageId}. Total: ${room.clients.size}`,
  );

  // Send sync step 2: the full document state as diff from empty state
  const fullState = Y.encodeStateAsUpdate(room.doc);
  const step2Msg = encodeSyncStep2(fullState);
  if (ws.readyState === ws.OPEN) {
    ws.send(step2Msg);
  }

  // Listen for Y.doc updates and broadcast to other clients
  const updateHandler = (update: Uint8Array, origin: unknown) => {
    // Only broadcast updates that came from this client (origin === ws)
    if (origin === ws) {
      const msg = encodeUpdate(update);
      for (const [clientWs] of room.clients) {
        if (clientWs !== ws && clientWs.readyState === clientWs.OPEN) {
          clientWs.send(msg);
        }
      }
    }
  };
  room.doc.on("update", updateHandler);

  // Handle incoming messages
  ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
    try {
      let buf: Uint8Array;
      if (Array.isArray(data)) {
        buf = new Uint8Array(Buffer.concat(data as Uint8Array[]));
      } else if (data instanceof ArrayBuffer) {
        buf = new Uint8Array(data);
      } else {
        buf = new Uint8Array(data);
      }

      if (buf.length === 0) return;

      const msgType = buf[0];
      const payload = buf.slice(1);

      switch (msgType) {
        case MSG_SYNC_STEP1: {
          // Client sent its state vector, respond with diff
          const diff = Y.encodeStateAsUpdate(room.doc, payload);
          const response = encodeSyncStep2(diff);
          if (ws.readyState === ws.OPEN) {
            ws.send(response);
          }
          break;
        }
        case MSG_SYNC_STEP2:
        case MSG_UPDATE: {
          // Apply update from client to doc (origin = ws for broadcasting)
          Y.applyUpdate(room.doc, payload, ws);
          break;
        }
        default:
          // Ignore unknown message types
          break;
      }
    } catch (err) {
      console.error("[yjs-rooms] Error handling message:", err);
    }
  });

  // Handle disconnect
  ws.on("close", async () => {
    room.doc.off("update", updateHandler);
    room.clients.delete(ws);

    console.log(
      `[yjs-rooms] Client ${userName} disconnected from page ${pageId}. Remaining: ${room.clients.size}`,
    );

    // Persist on disconnect
    await persistDoc(pageId, room.doc);

    // If no more clients, destroy room after a grace period
    if (room.clients.size === 0) {
      setTimeout(() => {
        const currentRoom = rooms.get(pageId);
        if (currentRoom && currentRoom.clients.size === 0) {
          destroyRoom(pageId);
          console.log(`[yjs-rooms] Room ${pageId} destroyed (no clients).`);
        }
      }, 30_000); // 30s grace period
    }
  });

  ws.on("error", (err) => {
    console.error(
      `[yjs-rooms] WebSocket error for ${userName} on page ${pageId}:`,
      err,
    );
  });
}

/* ---------- Utility ---------- */

export function getActiveRooms(): { pageId: string; clientCount: number }[] {
  const result: { pageId: string; clientCount: number }[] = [];
  for (const [pageId, room] of rooms) {
    result.push({ pageId, clientCount: room.clients.size });
  }
  return result;
}

export async function shutdownAllRooms(): Promise<void> {
  console.log("[yjs-rooms] Shutting down all rooms...");
  for (const [pageId, room] of rooms) {
    await persistDoc(pageId, room.doc);
    destroyRoom(pageId);
  }
  console.log("[yjs-rooms] All rooms shut down.");
}
