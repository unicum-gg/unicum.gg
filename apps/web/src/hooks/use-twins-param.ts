"use client";

import { useCallback, useSyncExternalStore } from "react";
import { sharedParamStore } from "@/lib/url-param-store";

/** The query param a tank page's twins switch is held in. */
export const TWINS_PARAM = "twins";

const store = sharedParamStore(TWINS_PARAM);

/**
 * Whether a tank page reads its twins together with it, in `?twins=1`.
 *
 * In the URL so "the Grom with the Dream Chaser" is a link, and shared across
 * the page through the param store, so every panel that offers the switch
 * moves together. The tank pages are static, so the server always renders the
 * vehicle alone and a linked `?twins=1` is applied on hydration: both readings
 * are in the HTML and this only picks which one shows. Off carries no param,
 * since it is the page as it has always been.
 */
export function useTwinsParam(): [boolean, (next: boolean) => void] {
  const on = useSyncExternalStore(
    store.subscribe,
    () => store.read() === "1",
    () => false,
  );
  const setOn = useCallback(
    (next: boolean) => store.write(next ? "1" : null),
    [],
  );
  return [on, setOn];
}
