"use client";

import { useSyncExternalStore } from "react";

/** Subscribing to nothing: the answer flips exactly once, at hydration, and
 * React already re-renders then. Declared at module scope so the subscribe
 * function is referentially stable across renders. */
const noop = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * False on the server and on the first client render, true from then on.
 *
 * The gate anything session-dependent needs. The auth client can answer
 * synchronously from its cache on the very first client render, while the
 * server rendered with no session at all, so a component that branches on the
 * session directly puts two different trees on the two sides and React throws
 * the subtree away and rebuilds it.
 *
 * `useSyncExternalStore` rather than a `useState` flipped in an effect: the
 * effect version is the obvious way to write this and the React compiler
 * rejects it (`react-hooks/set-state-in-effect`), because it is a cascading
 * render by construction. The three arguments here are the store contract used
 * for its server/client snapshot split alone.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, onClient, onServer);
}
