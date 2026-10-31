import type { Cache, ScopedMutator } from "swr";

/** A player's profile payload or their battles list, keyed on its SDK URL. */
const PLAYER_KEY = /\/players\/[^/?]+(\/battles)?(\?|$)/;

/**
 * Carry a change of the battle-list switch onto every view of that player
 * already on screen.
 *
 * The switch lives in the settings dialog, which the player usually opens from
 * their own profile, and the tab under it is held by SWR: nothing would move
 * until the next reload. So each cached profile and battle list of this
 * account is rewritten with the new state at once, then refetched to bring the
 * server's answer in behind it.
 *
 * Matched on the account id the payloads carry rather than on the nickname in
 * the key, since the session knows the account and the key spells the name the
 * way the reader typed it.
 */
export function applyBattlesPrivacy(
  cache: Cache,
  mutate: ScopedMutator,
  accountId: number,
  hidden: boolean,
): void {
  for (const key of cache.keys()) {
    if (typeof key !== "string" || !PLAYER_KEY.test(key)) continue;
    const data = cache.get(key)?.data as
      | { accountId?: number; player?: { accountId?: number } }
      | undefined;
    const owner = data?.accountId ?? data?.player?.accountId;
    if (owner !== accountId) continue;
    // A battles list carries `hidden`, a profile carries `battlesHidden`, and
    // either answer is the one the server will give once the refetch lands.
    void mutate(
      key,
      (current: Record<string, unknown> | undefined) =>
        current &&
        ("battles" in current
          ? { ...current, hidden }
          : { ...current, battlesHidden: hidden }),
      { revalidate: true },
    );
  }
}
