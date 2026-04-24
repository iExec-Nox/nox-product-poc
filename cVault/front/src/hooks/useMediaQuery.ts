"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether a CSS media query currently matches. Returns `false` during SSR to avoid a
 * hydration mismatch, then reflects the real value after the first client-side effect.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
