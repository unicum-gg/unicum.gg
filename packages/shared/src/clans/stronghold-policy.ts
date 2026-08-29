import type { ClanStrongholdData } from "@unicum.gg/wargaming";

/**
 * How often a clan's Stronghold record is re-sampled, keyed on whether it is
 * actually playing. The direct counterpart of the player snapshot pipeline's
 * `REFRESH_CADENCE_MS` (players/refresh-policy.ts), and for the same reason: a
 * period column can only be as fine as the sampling behind it.
 *
 * The clan side used to have no cadence at all, just a flat 24h floor on writes
 * plus whatever order the backfill happened to reach a clan in, which, being
 * bound to the 1 rps clan portal, was a multi-day cycle. So the "Last 24h"
 * column diffed against a baseline a median of NINE DAYS old, and "Last 7d"
 * against ten, which made the two columns show the same number.
 *
 * Sampling an active clan every 6h is what puts a real baseline within the 24h
 * window. It is affordable because the active population is tiny: of ~126k EU
 * clans, ~1.5k have played a single Stronghold battle in the last 30 days.
 */
export enum StrongholdActivityBucket {
  /** Battles inside WG's trailing 28-day window. */
  Active = "active",
  /** Has a Stronghold history but nothing recent. */
  Dormant = "dormant",
  /** Has a Stronghold, has never fought in it. */
  Empty = "empty",
  /** No Stronghold at all (the host 404s). The majority of clans. */
  None = "none",
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Target time between two samples per bucket.
 *
 * There is no "never sampled" member: that state is carried by the column's
 * `epoch` default, which sorts to the head of the `due_at ASC` claim on its own.
 * An enum member for it would be unreachable from `strongholdBucketFor` and a
 * standing invitation to write a due date that never comes back round.
 *
 * Steady-state cost on EU with the measured population (~1.5k active, ~54k
 * dormant, ~72k without a fort): roughly 28k requests/day, ~0.3 rps. That is
 * an order of magnitude under this pool's ceiling (DEFAULT_STRONGHOLD_RPS), and
 * LESS total volume than the old undirected sweep, the cadence spends the
 * budget where it changes something instead of spreading it evenly over a
 * population that is 98% idle.
 */
export const STRONGHOLD_CADENCE_MS: Record<StrongholdActivityBucket, number> = {
  [StrongholdActivityBucket.Active]: 6 * HOUR_MS,
  [StrongholdActivityBucket.Dormant]: 3 * DAY_MS,
  [StrongholdActivityBucket.Empty]: 14 * DAY_MS,
  [StrongholdActivityBucket.None]: 30 * DAY_MS,
};

export const STRONGHOLD_BUCKET_LABEL: Record<StrongholdActivityBucket, string> =
  {
    [StrongholdActivityBucket.Active]: "Played in the last 28 days",
    [StrongholdActivityBucket.Dormant]: "No recent battles",
    [StrongholdActivityBucket.Empty]: "Stronghold never used",
    [StrongholdActivityBucket.None]: "No Stronghold",
  };

/**
 * Which bucket a freshly-fetched Stronghold record falls into. `null` is the
 * host's 404, i.e. the clan has no Stronghold, a real answer, not a failure
 * (see `StrongholdResource.clan`).
 *
 * Activity is read from WG's own `battles_count_for_last_28_days` rather than
 * diffed against our previous snapshot: it is already in the response we just
 * paid for, and it stays correct across a gap in our own sampling, which a diff
 * against a stale row would not.
 */
export function strongholdBucketFor(
  data: ClanStrongholdData | null,
): StrongholdActivityBucket {
  if (!data) return StrongholdActivityBucket.None;
  const modes = [
    data.t6?.skirmish,
    data.t8?.skirmish,
    data.t10?.skirmish,
    data.t10?.advances,
  ];
  if (modes.some((m) => (m?.battles28d ?? 0) > 0)) {
    return StrongholdActivityBucket.Active;
  }
  if (modes.some((m) => (m?.battles ?? 0) > 0)) {
    return StrongholdActivityBucket.Dormant;
  }
  return StrongholdActivityBucket.Empty;
}

/** When a clan in this bucket should next be sampled, from now. */
export function strongholdDueAt(bucket: StrongholdActivityBucket): Date {
  return new Date(Date.now() + STRONGHOLD_CADENCE_MS[bucket]);
}

/** The due date for a clan we just fetched. Convenience over the two above, for
 * the write path that holds the response and nothing else. */
export function strongholdDueAtFor(data: ClanStrongholdData | null): Date {
  return strongholdDueAt(strongholdBucketFor(data));
}
