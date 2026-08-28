import type { Region } from "@unicum.gg/wargaming";
import {
  axisBaseline,
  buildProfile,
  closestAxes,
  computeSpecRanges,
  distinguishingAxes,
  PROFILE_FIELD_KEYS,
  SIMILAR_RESULTS_MAX,
  furthestAxis,
  similarity,
  specFingerprint,
  type AxisGap,
  type ProfileSource,
  type SpecRanges,
  type TankAxis,
} from "@unicum.gg/shared";
import { cachedInRedis } from "@unicum.gg/core/redis";
import {
  getTankDataset,
  type TankDatasetRow,
  type TankRowIdentity,
} from "@unicum.gg/core/wargaming/wot/tanks/dataset";

/**
 * Which other vehicles play like this one.
 *
 * Not "which have the same numbers": which stand in the same place among their
 * own peers (see `similarity` in shared for why that is the question). This
 * module supplies the two halves that measurement needs, the values and the
 * peers, and decides who is eligible to be an answer at all.
 */

// A day, matching the catalogue ranges: the values only move when the vehicles
// cron reparses the client mirror, and the server averages are recomputed
// nightly. Nothing here shifts a placement mid-day.
const RANGES_TTL_SECONDS = 86_400;

// The matches themselves keep as long as the ranges they were measured against:
// both are recomputed from a catalogue that moves once a day at most.
const RESULT_TTL_SECONDS = 86_400;

/**
 * Bump on any change to what these caches hold.
 *
 * Every payload below is a structured object read back by code that may be a
 * deploy newer than the writer, and a day is a long time to serve a shape the
 * reader no longer understands: adding a field to a cached tank payload once
 * crashed this site for 26 hours on cache hits alone. The sibling tank caches
 * (`detail-cache`, `compare-cache`) key on their own version for the same
 * reason, so a new shape simply reads through to a fresh computation.
 */
const SHAPE_VERSION = 1;

/**
 * How far up and down the tiers an answer may come from.
 *
 * One, not zero: the vehicle a player is being pointed at is often the tier
 * above or below (the tech-tree neighbour that plays the same way is the most
 * useful recommendation there is). Not two, because a tier VIII and a tier X
 * never meet in a battle, and telling a player they are alike stops being
 * practical advice.
 */
const TIER_SPREAD = 1;

/** How many axes of agreement are named on a result. Two reads as a reason
 * ("mobility and concealment"), five reads as a dump. */
const NAMED_AXES = 2;

/**
 * How many matches are worked out and kept, however few the caller asks for.
 *
 * One cached list per vehicle rather than one per requested length: the work is
 * the same either way (every candidate is measured before any is ranked), and
 * caching per length would multiply the entries for nothing. Callers take what
 * they need off the front.
 *
 * The number itself is shared with the endpoint that documents how many a
 * caller may ask for, so the ceiling it advertises is the one served.
 */
const CACHED_RESULTS = SIMILAR_RESULTS_MAX;

export type SimilarTank = {
  identity: TankRowIdentity;
  /** How alike the two are, 0 to 100. */
  score: number;
  /** The axes they are closest on, nearest first: why they are paired. */
  closest: TankAxis[];
  /** The axis they are furthest apart on, so the pairing states its own limit.
   * Null when nothing could be measured to differ. */
  furthest: TankAxis | null;
};

/**
 * The values a vehicle is measured on: its specifications and how the server
 * plays it, flattened into one object.
 *
 * Everything is passed through, not just the fields the profile reads. The
 * profile picks what it needs by name, so a field it starts reading later is
 * measured without this function having to hear about it.
 */
function profileSource(row: TankDatasetRow): ProfileSource | null {
  if (!row.specs && !row.stats) return null;
  return { ...row.specs, ...row.stats } as ProfileSource;
}

/**
 * A source narrowed to the fields a profile reads.
 *
 * `profileSource` deliberately passes everything through, so a field the
 * profile starts reading later is available without it hearing about it. The
 * ranges are the other side of that trade: measuring a value nothing looks up
 * means sorting and quantiling it for every tier, then carrying it in a cached
 * payload for a day. Winrate, battle counts and the mark tallies are the bulk
 * of the server averages and none of them is a profile field.
 */
function measuredOnly(source: ProfileSource | null): ProfileSource | null {
  if (!source) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (PROFILE_FIELD_KEYS.has(key)) out[key] = value;
  }
  return out as ProfileSource;
}

/**
 * The spread of every measured value, tier by tier.
 *
 * The whole point of the exercise: measured over the catalogue, a tier X's hit
 * points and a tier VI's hit points are two different worlds, and every tier X
 * comes out looking alike. Measured within the tier, a value says where the
 * vehicle stands among the ones it actually fights alongside, which is the
 * reading that survives being compared across tiers.
 */
async function computeTierRanges(
  region: Region,
): Promise<Record<string, SpecRanges>> {
  const dataset = await getTankDataset(region);
  const byTier = new Map<number, (ProfileSource | null)[]>();
  for (const row of dataset) {
    const list = byTier.get(row.identity.tier);
    if (list) list.push(profileSource(row));
    else byTier.set(row.identity.tier, [profileSource(row)]);
  }
  const out: Record<string, SpecRanges> = {};
  for (const [tier, sources] of byTier) {
    out[String(tier)] = computeSpecRanges(sources.map(measuredOnly));
  }
  return out;
}

function getTierRanges(region: Region): Promise<Record<string, SpecRanges>> {
  return cachedInRedis(
    `tanks:tier-ranges:v${SHAPE_VERSION}:${region}`,
    RANGES_TTL_SECONDS,
    () => computeTierRanges(region),
  );
}

/** Artillery is its own game. A gun that fires from the other side of the map
 * has no counterpart among vehicles that drive to their targets, and left
 * unguarded it pairs with whatever sniping tank destroyer happens to sit low on
 * mobility. So SPGs answer for SPGs, and nothing else does. */
function sameFamily(a: TankRowIdentity, b: TankRowIdentity): boolean {
  return (a.type === "SPG") === (b.type === "SPG");
}

/**
 * One vehicle per set of identical characteristics, and which one it is.
 *
 * The catalogue carries the same machine several times over: a reissue for a
 * mode (`Object 140 7x7`), for an event, for a cybercafe (`IS-7 IGR`), or a
 * rebadge sold as its own premium (`Monkey King` is a `121B`). They all measure
 * the same, so left alone they crowd the answers with a vehicle the reader is
 * already looking at, or with three names for one recommendation.
 *
 * The one kept is the plainest: the shortest tag, which is the tank the others
 * are reissues of, since a reissue's tag is the original's plus a suffix. Ties
 * (there should be none) go to the lowest id, so the choice is stable across
 * renders.
 */
/**
 * Which vehicles are the same machine as which, as small numbers.
 *
 * `groupOf` maps a vehicle to its duplicate group, `canonicalOf` names the one
 * vehicle that answers for each group. Numbers rather than the fingerprints
 * themselves: a fingerprint is a kilobyte of column values, and this is cached
 * per region, so carrying 1200 of them would be a megabyte of Redis to say
 * something two integers say.
 */
export type DuplicateIndex = {
  groupOf: Record<string, number>;
  canonicalOf: Record<string, number>;
};

/**
 * One vehicle per set of identical characteristics, and which one it is.
 *
 * The catalogue carries the same machine several times over: a reissue for a
 * mode (`Object 140 7x7`), for an event, for a cybercafe (`IS-7 IGR`), or a
 * rebadge sold as its own premium (`Monkey King` is a `121B`). They all measure
 * the same, so left alone they crowd the answers with a vehicle the reader is
 * already looking at, or with three names for one recommendation.
 *
 * The one kept is the plainest **of those that can be an answer at all**: the
 * shortest tag among the group's eligible members, since a reissue's tag is the
 * original's plus a suffix. Electing over the whole group instead would lose
 * real vehicles, and does: three pairs on EU (`Radkampfwagen`/`Fossa VM 68`,
 * `T32M`/`T-832`, `Waffenträger auf E 100 T`/`Erlang Shen`) have their
 * shorter-tagged member sitting outside the live game, so it would win the
 * election and take the playable one out of every result list with it. A group
 * with no eligible member keeps its plainest anyway; nothing will ask for it.
 */
function buildDuplicateIndex(dataset: TankDatasetRow[]): DuplicateIndex {
  const groups = new Map<string, number>();
  const groupOf: Record<string, number> = {};
  const best = new Map<number, { tankId: number; tag: string; eligible: boolean }>();

  for (const row of dataset) {
    const print = specFingerprint(profileSource(row));
    if (!print) continue;
    let group = groups.get(print);
    if (group === undefined) {
      group = groups.size;
      groups.set(print, group);
    }
    const { tankId, tag } = row.identity;
    groupOf[String(tankId)] = group;

    const eligible = canAnswer(row);
    const held = best.get(group);
    if (
      !held ||
      // An eligible member always beats an ineligible one, whatever the tags say.
      (eligible && !held.eligible) ||
      (eligible === held.eligible &&
        (tag.length < held.tag.length ||
          (tag.length === held.tag.length && tankId < held.tankId)))
    ) {
      best.set(group, { tankId, tag, eligible });
    }
  }

  const canonicalOf: Record<string, number> = {};
  for (const [group, winner] of best) canonicalOf[String(group)] = winner.tankId;
  return { groupOf, canonicalOf };
}

function getDuplicateIndex(region: Region): Promise<DuplicateIndex> {
  // Cached like the ranges beside it, and for the same reason: the answer is
  // the same for every vehicle of the region, while the work behind it is a
  // full pass over the catalogue. Recomputing it per request meant a crawler
  // sweeping the ~1200 tank pages on a cold cache paid for it every time.
  return cachedInRedis(
    `tanks:duplicates:v${SHAPE_VERSION}:${region}`,
    RANGES_TTL_SECONDS,
    async () => buildDuplicateIndex(await getTankDataset(region)),
  );
}

/**
 * Whether a vehicle exists in the live game, which is what makes it usable as
 * an answer at all. See `isCandidate` for why having server averages is the
 * test, and `buildDuplicateIndex` for why the election has to know it too.
 */
function canAnswer(row: TankDatasetRow): boolean {
  return !row.identity.isCommonTest && !!row.stats;
}

/**
 * Whether a vehicle may be offered as an answer for another.
 *
 * Class is deliberately not a condition. A heavy with no armour coming out
 * alongside mediums is the comparison working, not failing: that is what the
 * vehicle plays like, whatever the game files call it.
 *
 * Being played is a condition, and it does more work than it looks like. The
 * catalogue holds vehicles nobody can take into a battle: cybercafe reissues,
 * mode-locked editions, event one-offs, each a real vehicle with real
 * characteristics, and several of them near-copies of a famous tank (the
 * `IS-7 IGR` is an IS-7 with 250 fewer hit points). They measure as excellent
 * answers and are useless as ones. Having server averages at all is the
 * evidence that a tank exists in the living game, and it costs nothing to read:
 * a vehicle players own and take out has them, a vehicle nobody can obtain has
 * none. The vehicle being *read about* is held to no such test, so the page of
 * a brand new tank still recommends.
 */
function isCandidate(ref: TankRowIdentity, other: TankDatasetRow): boolean {
  if (other.identity.tankId === ref.tankId) return false;
  if (Math.abs(other.identity.tier - ref.tier) > TIER_SPREAD) return false;
  if (!sameFamily(ref, other.identity)) return false;
  // Answers come from the live game, whatever the vehicle being read is. On a
  // test build's page that is the whole question a reader has: which of the
  // tanks I already know does this one play like.
  return canAnswer(other);
}

/**
 * The vehicles most like this one, best match first.
 *
 * Ties are broken on role, then class, then id: at the same score the game's
 * own idea of how a vehicle is played is the better tiebreak, and the id makes
 * the order stable so the same page does not reshuffle between two renders.
 *
 * Returns an empty list rather than throwing when the vehicle is unknown or too
 * little of it is measurable, since this is a section of a page, not the page.
 */
export async function getSimilarTanks(
  region: Region,
  tankId: number,
  limit: number,
): Promise<SimilarTank[]> {
  const all = await cachedInRedis(
    `tanks:similar:v${SHAPE_VERSION}:${region}:${tankId}`,
    RESULT_TTL_SECONDS,
    () => computeSimilarTanks(region, tankId),
  );
  return all.slice(0, limit);
}

async function computeSimilarTanks(
  region: Region,
  tankId: number,
): Promise<SimilarTank[]> {
  const [dataset, tierRanges, duplicates] = await Promise.all([
    getTankDataset(region),
    getTierRanges(region),
    getDuplicateIndex(region),
  ]);

  const ref = dataset.find((row) => row.identity.tankId === tankId);
  if (!ref) return [];
  const refProfile = buildProfile(
    profileSource(ref),
    tierRanges[String(ref.identity.tier)] ?? {},
  );

  const { groupOf, canonicalOf } = duplicates;
  const refGroup = groupOf[String(ref.identity.tankId)];

  const measured: { identity: TankRowIdentity; score: number; gaps: AxisGap[] }[] =
    [];
  for (const row of dataset) {
    if (!isCandidate(ref.identity, row)) continue;
    const group = groupOf[String(row.identity.tankId)];
    if (group !== undefined) {
      // The same machine under another name, whether it is the vehicle being
      // read (a reissue of it) or a second name for an answer already given.
      if (group === refGroup) continue;
      if (canonicalOf[String(group)] !== row.identity.tankId) continue;
    }
    const profile = buildProfile(
      profileSource(row),
      tierRanges[String(row.identity.tier)] ?? {},
    );
    const match = similarity(refProfile, profile);
    if (!match) continue;
    measured.push({
      identity: row.identity,
      score: match.score,
      gaps: match.gaps,
    });
  }

  // What counts as close is settled against the whole field this vehicle was
  // measured against, not in the abstract. See `distinguishingAxes`.
  const baseline = axisBaseline(measured.map((m) => m.gaps));
  const scored: SimilarTank[] = measured.map((m) => {
    const ranked = distinguishingAxes(m.gaps, baseline);
    return {
      identity: m.identity,
      score: m.score,
      closest: closestAxes(ranked, NAMED_AXES),
      furthest: furthestAxis(ranked),
    };
  });

  // Ordered on the rounded score, the one the page prints: sorting on the raw
  // distance would put an 88 above another 88 for a reason the reader is never
  // shown. The tiebreaks below are what settles those.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const roleA = a.identity.role === ref.identity.role ? 0 : 1;
    const roleB = b.identity.role === ref.identity.role ? 0 : 1;
    if (roleA !== roleB) return roleA - roleB;
    const typeA = a.identity.type === ref.identity.type ? 0 : 1;
    const typeB = b.identity.type === ref.identity.type ? 0 : 1;
    if (typeA !== typeB) return typeA - typeB;
    return a.identity.tankId - b.identity.tankId;
  });

  return scored.slice(0, CACHED_RESULTS);
}
