/**
 * Unit comparison picks (client only). The shortlist lives in localStorage so it survives moving
 * between pages; the comparison itself is a plain URL (/compare?u=id,id,id) that can be shared.
 */
import { useSyncExternalStore } from "react";
import { COMPARE_MAX } from "./site";

export { COMPARE_MAX };
const KEY = "pp_compare";
const EVENT = "pp:compare";
const ID_RE = /^[a-f0-9]{24}$/;
const EMPTY = [];

let cache = null; // { raw, list } — useSyncExternalStore needs a stable snapshot

function read() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // storage blocked (private mode etc.) → empty shortlist
  }
  if (cache && cache.raw === raw) return cache.list;
  let list = EMPTY;
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) {
      list = parsed.filter((u) => u && ID_RE.test(u.id) && typeof u.label === "string").slice(0, COMPARE_MAX);
    }
  } catch {
    list = EMPTY;
  }
  cache = { raw, list };
  return list;
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore — the tray just won't remember across pages
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb) {
  const onStorage = (e) => e.key === KEY && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage); // other tabs
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export const useCompareList = () => useSyncExternalStore(subscribe, read, () => EMPTY);

/** item = { id, label, project } — label/project are display text for the tray. */
export function toggleCompare(item) {
  const list = read();
  if (list.some((u) => u.id === item.id)) {
    write(list.filter((u) => u.id !== item.id));
    return "removed";
  }
  if (list.length >= COMPARE_MAX) return "full";
  write([...list, { id: item.id, label: String(item.label).slice(0, 60), project: String(item.project ?? "").slice(0, 80) }]);
  return "added";
}

export const removeCompare = (id) => write(read().filter((u) => u.id !== id));
export const clearCompare = () => write([]);
export const compareHref = (list) => `/compare?u=${list.map((u) => u.id).join(",")}`;
