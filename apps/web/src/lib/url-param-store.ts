/**
 * A value held in the URL, read through `useSyncExternalStore`.
 *
 * Several things need one (the battle a page is playing, the suggestion a dialog
 * is correcting, the page a table is on) and they all need it for the same
 * reason: the value has to be linkable, and holding the same truth twice drifts.
 * Reading it from the URL means the link works by construction, and Back leaves
 * the page as it found it.
 *
 * Written with `replaceState` rather than a router navigation: it reflects state
 * rather than a new page, and a history entry per click would make Back mean
 * "the previous battle". `replaceState` fires no event, so readers are notified
 * here; `popstate` covers Back and Forward, which move the param without us.
 *
 * **Subscribers are notified for every param, not just their own.** Two stores
 * built on the same name would otherwise not hear each other, which is the one
 * bug this abstraction exists to make impossible: a leaderboard mounts the same
 * table three times (one per rating metric) and all three read `?page=`. A
 * reader whose own value did not move re-reads it and React bails out on the
 * identical snapshot, so the cost of the extra breadth is a comparison.
 */
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((onChange) => onChange());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

export type ParamStoreOptions = {
  /**
   * Drop the URL fragment on every write.
   *
   * For a param whose fragment carries something scoped to its value: the
   * correction dialog is reached with a signed token in the hash, and that
   * token is minted for one row. Clearing it on any write means opening a
   * second row cannot silently carry the first one's credential, and closing
   * the dialog cannot leave a live one in the address bar.
   */
  clearHashOnWrite?: boolean;
};

export type ParamStore = {
  subscribe: (onChange: () => void) => () => void;
  read: () => string | null;
  write: (value: string | null) => void;
};

export function createParamStore(
  name: string,
  options?: ParamStoreOptions,
): ParamStore {
  return {
    subscribe,
    read() {
      return new URLSearchParams(window.location.search).get(name);
    },
    write(value) {
      const params = new URLSearchParams(window.location.search);
      const hash = options?.clearHashOnWrite ? "" : window.location.hash;
      // A write that changes nothing is not a write: it would notify every
      // reader, and a reader that answers a notification by writing the value
      // back (several views of one table agreeing on a page) would never settle.
      // The hash is the exception, since clearing it IS the change.
      if (params.get(name) === value && hash === window.location.hash) return;
      if (value === null) params.delete(name);
      else params.set(name, value);
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}${hash}`,
      );
      notify();
    },
  };
}

export type NumericParamStore = {
  subscribe: (onChange: () => void) => () => void;
  read: () => number | null;
  write: (value: number | null) => void;
};

export function createNumericParamStore(
  name: string,
  options?: ParamStoreOptions,
): NumericParamStore {
  const store = createParamStore(name, options);
  return {
    subscribe: store.subscribe,
    read() {
      const raw = store.read();
      const value = Number(raw);
      return raw && Number.isInteger(value) ? value : null;
    },
    write(value) {
      store.write(value === null ? null : String(value));
    },
  };
}

const shared = new Map<string, ParamStore>();

/**
 * The store for a param several components read at once, memoized by name.
 *
 * They would agree anyway (a write notifies every listener), but a store
 * allocated per render hands `useSyncExternalStore` a new `subscribe` on every
 * pass and makes it tear the subscription down and build it again for nothing.
 */
export function sharedParamStore(name: string): ParamStore {
  const existing = shared.get(name);
  if (existing) return existing;
  const store = createParamStore(name);
  shared.set(name, store);
  return store;
}

/**
 * The whole query string, for building an href that keeps the params the reader
 * arrived with. Subscribed to through any store: the notification is global.
 */
export function readSearch(): string {
  return window.location.search;
}

export { subscribe as subscribeToParams };
