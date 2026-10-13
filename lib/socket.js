"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "@/lib/api/client";

/**
 * Socket.IO client (contract: API.md › Real-time). WebSockets can't ride the Next.js /api
 * rewrite, so this connects straight to the API host; staff auth is a 60-second token fetched
 * (same-origin, cookie-authenticated) right before EVERY connect attempt — `auth` as a function
 * makes reconnects pick up a fresh one automatically.
 *
 * One shared connection per tab and audience, opened on first use and closed when the last
 * subscriber leaves.
 */
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5030";

// Two pools: staff (authenticated, token per connect) and public (website visitors, no token —
// they must never call /auth/socket-token, whose 401 would trigger the session-expired flow).
const pools = { staff: { socket: null, users: 0 }, public: { socket: null, users: 0 } };

function acquire(kind) {
  const pool = pools[kind];
  if (!pool.socket) {
    pool.socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      ...(kind === "staff" && {
        auth: (cb) => {
          api
            .post("/auth/socket-token")
            .then((d) => cb({ token: d?.token }))
            .catch(() => cb({})); // still connects as a public client; staff subscribe then fails
        },
      }),
    });
  }
  pool.users += 1;
  if (!pool.socket.connected) pool.socket.connect();
  return pool.socket;
}

function release(kind) {
  const pool = pools[kind];
  pool.users = Math.max(0, pool.users - 1);
  if (pool.users === 0 && pool.socket) {
    pool.socket.disconnect();
    pool.socket = null;
  }
}

/**
 * Live `unit:status` deltas for one project (`scope`: 'staff' default, or 'public' for the website).
 * `onDelta(delta)` runs per event; `onResync()` runs after a reconnect (events may have been
 * missed while offline — refetch). Returns 'connecting' | 'live' | 'offline'.
 */
export function useProjectLive(projectId, { onDelta, onResync, scope = "staff" } = {}) {
  const [state, setState] = useState("connecting");
  const handlers = useRef({ onDelta, onResync });
  useEffect(() => {
    handlers.current = { onDelta, onResync };
  });

  useEffect(() => {
    if (!projectId) return undefined;
    const kind = scope === "public" ? "public" : "staff";
    const s = acquire(kind);
    let first = true;

    const subscribe = () => {
      s.emit("subscribe", { projectId, scope }, (ack) => {
        setState(ack?.ok ? "live" : "offline");
        if (ack?.ok && !first) handlers.current.onResync?.();
        first = false;
      });
    };
    const onDisconnect = () => setState("offline");
    const onError = () => setState("offline");
    const onStatus = (delta) => {
      if (delta?.projectId === projectId) handlers.current.onDelta?.(delta);
    };

    if (s.connected) subscribe();
    s.on("connect", subscribe);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onError);
    s.on("unit:status", onStatus);
    return () => {
      s.off("connect", subscribe);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onError);
      s.off("unit:status", onStatus);
      if (s.connected) s.emit("unsubscribe", { projectId, scope });
      release(kind);
    };
  }, [projectId, scope]);

  return state;
}
