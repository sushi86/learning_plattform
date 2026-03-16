/**
 * Custom Next.js server with integrated WebSocket server for Y.js real-time sync.
 *
 * Routes:
 *   - HTTP: All requests → Next.js
 *   - WS: /ws/page/[pageId]?token=<jwt> → Y.js sync
 *   - WS: /_next/* → Next.js HMR (dev only)
 */
import "dotenv/config";
import { createServer } from "http";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { parse } from "url";
import {
  authenticateWsToken,
  extractTokenFromUrl,
  extractPageIdFromUrl,
} from "./src/server/ws-auth.js";
import {
  handleConnection,
  shutdownAllRooms,
} from "./src/server/yjs-rooms.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

async function main() {
  // Initialize Next.js
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  const upgradeHandler = app.getUpgradeHandler();
  await app.prepare();

  // Create HTTP server
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });

  // Create WebSocket server for Y.js (no separate port, attached to HTTP server)
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade requests
  server.on("upgrade", async (req, socket, head) => {
    const url = req.url || "";

    // Our Y.js WebSocket route
    if (url.startsWith("/ws/page/")) {
      // Extract and validate page ID
      const pageId = extractPageIdFromUrl(url);
      if (!pageId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      // Extract and validate JWT token
      const token = extractTokenFromUrl(url);
      const user = await authenticateWsToken(token);
      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      // Upgrade to WebSocket
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, { pageId, user });
      });
      return;
    }

    // Everything else (including /_next/webpack-hmr) → Next.js
    upgradeHandler(req, socket, head);
  });

  // Handle new WebSocket connections
  wss.on(
    "connection",
    (
      ws: WebSocket,
      _req: unknown,
      ctx: {
        pageId: string;
        user: { id: string; name: string; email: string; role: string };
      },
    ) => {
      handleConnection(ws, ctx.pageId, ctx.user.id, ctx.user.name);
    },
  );

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[server] Shutting down gracefully...");
    await shutdownAllRooms();
    wss.close();
    server.close(() => {
      console.log("[server] HTTP server closed.");
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start listening
  server.listen(port, () => {
    console.log(
      `[server] MathBoard running at http://${hostname}:${port} (${dev ? "development" : "production"})`,
    );
    console.log(
      `[server] WebSocket endpoint: ws://${hostname}:${port}/ws/page/[pageId]`,
    );
  });
}

main().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
