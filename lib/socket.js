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
 * One shared connection per tab, opened on first use and closed when the last subscriber leaves.
 */
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5030";

let socket = null;
let users = 0;

function acquire() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      auth: (cb) => {
        api
          .post("/auth/socket-token")
          .then((d) => cb({ token: d?.token }))
          .catch(() => cb({})); // still connects as a public client; staff subscribe then fails
      },
    });
  }
  users += 1;
  if (!socket.connected) socket.connect();
  return socket;
}

function release() {
  users = Math.max(0, users - 1);
  if (users === 0 && socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Live `unit:status` deltas for one project (staff scope).
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
    const s = acquire();
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
      release();
    };
  }, [projectId, scope]);

  return state;
}
