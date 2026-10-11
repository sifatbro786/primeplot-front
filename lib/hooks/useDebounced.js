"use client";

import { useEffect, useState } from "react";

/** Value that settles `delay` ms after the last change (search boxes). */
export function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}
