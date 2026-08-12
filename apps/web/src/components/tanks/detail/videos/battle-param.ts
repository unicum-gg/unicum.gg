/**
 * The battle being watched, in the URL.
 *
 * A tiny store over one query param, read through `useSyncExternalStore` by the
 * player. It exists because the param has to anyway, so a battle can be linked
 * to, and holding the same truth twice drifts: opening a `?battle=` link would
 * otherwise mean an effect pushing it into state, the pattern the compiler
 * rejects and for good reason. Here the link works by construction.
 *
 * Its own module rather than a corner of the player: the community index links
 * to it, and importing the constant should not drag a video player into that
 * page's bundle.
 */
export const BATTLE_PARAM = "battle";

/** Written with `replaceState` rather than a router navigation, like the list
 * filters: it reflects state, not a new page, and a history entry per click
 * would make Back mean "the previous battle". `replaceState` fires no event, so
 * readers are notified here; `popstate` covers Back and Forward, which move the
 * param without us. */
const listeners = new Set<() => void>();

export function subscribeToBattleParam(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

export function readBattleParam(): number | null {
  const raw = new URLSearchParams(window.location.search).get(BATTLE_PARAM);
  const id = Number(raw);
  return raw && Number.isInteger(id) ? id : null;
}

export function writeBattleParam(id: number | null): void {
  const params = new URLSearchParams(window.location.search);
  if (id === null) params.delete(BATTLE_PARAM);
  else params.set(BATTLE_PARAM, String(id));
  const qs = params.toString();
  window.history.replaceState(
    null,
    "",
    qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
  );
  listeners.forEach((notify) => notify());
}
