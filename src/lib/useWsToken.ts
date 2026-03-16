"use client";

import { useState, useEffect } from "react";

/**
 * Fetches the WebSocket authentication token from the server.
 * The token is the NextAuth session JWT that can be used to authenticate WS connections.
 */
export function useWsToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchToken() {
      try {
        const res = await fetch("/api/auth/ws-token");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setToken(data.token);
          }
        }
      } catch {
        // Will retry on next render or reconnect
      }
    }

    fetchToken();

    return () => {
      cancelled = true;
    };
  }, []);

  return token;
}
