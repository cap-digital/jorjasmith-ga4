"use client";

import { useSyncExternalStore } from "react";

const WIDE_QUERY = "(min-width: 640px)";

/** True at Tailwind's `sm` breakpoint and up; assumes wide during SSR. */
export function useIsWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}
