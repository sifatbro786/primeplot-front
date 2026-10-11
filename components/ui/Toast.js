"use client";

import { useSyncExternalStore } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * Minimal toast store (no library). Call from anywhere on the client:
 *   toast.success("Saved")   toast.error(err.message)   toast("Plain note")
 */
let items = [];
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
let seq = 0;

function push(kind, message, { duration = kind === "error" ? 7000 : 4000 } = {}) {
  const id = ++seq;
  items = [...items.slice(-3), { id, kind, message }];
  emit();
  if (duration) setTimeout(() => dismiss(id), duration);
  return id;
}
function dismiss(id) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = Object.assign((m, o) => push("info", m, o), {
  success: (m, o) => push("success", m, o),
  error: (m, o) => push("error", m, o),
  info: (m, o) => push("info", m, o),
  dismiss,
});

const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));
const EMPTY = [];

const ICON = { success: CircleCheck, error: CircleAlert, info: Info };
const TONE = { success: "text-success", error: "text-danger", info: "text-info" };

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  const t = useTranslations("common");
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
    >
      {list.map((item) => {
        const Icon = ICON[item.kind];
        return (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className="toast-in pointer-events-auto flex items-start gap-3 rounded-md border border-line bg-surface px-4 py-3 text-sm shadow-[0_8px_24px_-12px_rgb(28_29_26_/_0.25)]"
          >
            <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", TONE[item.kind])} />
            <p className="flex-1 leading-snug">{item.message}</p>
            <button type="button" onClick={() => dismiss(item.id)} className="-m-1 p-1 text-ink-subtle hover:text-ink" aria-label={t("dismiss")}>
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
