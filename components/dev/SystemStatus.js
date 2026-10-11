"use client";

import { useEffect, useState } from "react";

// Phase 0 wiring check: browser → Next rewrite (/api/v1) → Express → MongoDB.
// Removed when the real home page lands (F2).
export default function SystemStatus() {
  const [state, setState] = useState({ phase: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/v1/health/ready", { signal: ctrl.signal, cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        setState({ phase: "done", httpStatus: res.status, body });
      })
      .catch((err) => {
        if (err.name !== "AbortError") setState({ phase: "error", message: err.message });
      });
    return () => ctrl.abort();
  }, []);

  const pending = state.phase === "loading" ? "…" : null;
  // Express answered only if we got its JSON envelope back (a dead backend yields a Next 500 page).
  const apiUp = Boolean(state.body?.data);
  const rows = [
    ["Next.js → /api/v1 proxy", pending ?? (state.phase === "done" ? "up" : "down")],
    ["Express API", pending ?? (apiUp ? "up" : "down")],
    ["MongoDB Atlas", pending ?? state.body?.data?.checks?.database ?? "down"],
  ];

  return (
    <dl className="divide-y divide-line border-y border-line font-mono text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between py-3">
          <dt className="text-ink-muted">{label}</dt>
          <dd className="flex items-center gap-2">
            <span
              aria-hidden
              className={`inline-block size-2 rounded-xs ${
                value === "up" ? "bg-status-available" : value === "…" ? "bg-status-held" : "bg-danger"
              }`}
            />
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
