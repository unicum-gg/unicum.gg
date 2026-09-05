"use client";

import { useSyncExternalStore } from "react";

/** Subscribing to nothing: the answer is read once per render, and a page does
 * not need to re-render at the exact second a deadline lapses. Declared at
 * module scope so the subscribe function is referentially stable. */
const noop = () => () => {};

/**
 * Whether a moment is already in the past, answered on the CLIENT only.
 *
 * Reading the clock during render is impure, and on a `force-static` page it is
 * also wrong: the server's answer would be baked into HTML that may be served
 * hours later, so a deadline would look open long after it shut. The store
 * contract is what makes both correct at once, the same way `RelativeTime`
 * reads its clock. False on the server and on the first client render, so
 * nothing flips before hydration.
 */
export function usePassed(date: Date | null | undefined): boolean {
  const at = date?.getTime() ?? null;
  return useSyncExternalStore(
    noop,
    () => at !== null && at <= Date.now(),
    () => false,
  );
}
