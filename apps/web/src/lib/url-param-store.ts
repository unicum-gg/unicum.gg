/**
 * A number held in the URL, read through `useSyncExternalStore`.
 *
 * Two things need one (the battle a page is playing, the suggestion a dialog is
 * correcting) and both need it for the same reason: the value has to be
 * linkable, and holding the same truth twice drifts. Reading it from the URL
 * means the link works by construction, and Back leaves the page as it found it.
 *
 * Written with `replaceState` rather than a router navigation: it reflects state
 * rather than a new page, and a history entry per click would make Back mean
 * "the previous battle". `replaceState` fires no event, so readers are notified
 * here; `popstate` covers Back and Forward, which move the param without us.
 */
export type NumericParamStore = {
  subscribe: (onChange: () => void) => () => void;
  read: () => number | null;
  write: (value: number | null) => void;
};

export function createNumericParamStore(
  name: string,
  options?: {
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
  },
): NumericParamStore {
  const listeners = new Set<() => void>();

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      window.addEventListener("popstate", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("popstate", onChange);
      };
    },
    read() {
      const raw = new URLSearchParams(window.location.search).get(name);
      const value = Number(raw);
      return raw && Number.isInteger(value) ? value : null;
    },
    write(value) {
      const params = new URLSearchParams(window.location.search);
      if (value === null) params.delete(name);
      else params.set(name, String(value));
      const qs = params.toString();
      const hash = options?.clearHashOnWrite ? "" : window.location.hash;
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}${hash}`,
      );
      listeners.forEach((notify) => notify());
    },
  };
}
