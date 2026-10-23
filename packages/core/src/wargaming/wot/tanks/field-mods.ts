import {
  PostProgressionAction,
  type PostProgressionStep,
  Region,
  type PostProgressionModification,
  type TankPostProgression,
  WotSrcBranch,
} from "@unicum.gg/wargaming";
import { assetsRefFor, iconUrl } from "@unicum.gg/shared";
import { wg } from "../../client";
import { cachedInRedis } from "../../../redis";

// wot-src client data changes only on a game patch (refreshed daily by
// vehicles-cron); the parsed result is cached in Redis for a day (shared across
// instances, surviving deploys).
const WOTSRC_TTL_SECONDS = 24 * 60 * 60;

/** How a field modification changes one vehicle attribute (raw wot-src
 * attribute name; the front maps it to a displayed characteristic). */
export interface FieldModEffect {
  attribute: string;
  type: "mul" | "add";
  value: number;
}

/** A field modification with its display identity resolved (name from
 * `artefacts.po`, icon from the wot.assets mirror when the client has one). */
export interface FieldModItem {
  key: string;
  name: string;
  image: string | null;
  effects: FieldModEffect[];
}

/** One step of the tree, ordered by level: a base modification, a dual
 * ("Modification I/II") choice, or a QoL feature with no characteristic. */
export interface FieldModStep {
  level: number;
  kind: "feature" | "modification" | "pair";
  /** Feature steps: the raw feature key + display name, description and icon. */
  feature: {
    key: string;
    name: string;
    description: string | null;
    image: string | null;
  } | null;
  modification: FieldModItem | null;
  pair: { key: string; first: FieldModItem; second: FieldModItem } | null;
}

/** A tank's field-modification (post progression) tree. */
export interface TankFieldMods {
  treeKey: string;
  steps: FieldModStep[];
}

// Per branch for the same reason as the skill tree: a post-progression icon can
// be keyed by the vehicle, and an unreleased one has icons only the test branch
// of the assets mirror carries.
const assetsBase = (branch?: WotSrcBranch) =>
  iconUrl("vehPostProgression/actionItems", assetsRefFor(branch));

// The QoL features' icons live under `modificationWithFeature` by camelCase key
// (their display names come from the client localization, see `featureNames`).
const featureImage = (base: string, key: string): string => {
  const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  return `${base}/modificationWithFeature/120x80/${camel}.png`;
};

/**
 * A tank's raw post-progression tree, as wot-src declares it.
 *
 * Cached like the resolved tree below, and for a reason that only shows on the
 * battle pages: reading it fetches and parses four client XML files, three of
 * them shared by every vehicle, which is about half a second of CPU to answer
 * something that only changes with a game patch. Uncached, every battle
 * carrying field modifications paid that per vehicle, on every view.
 */
export function getTankPostProgression(
  region: Region,
  tankId: number,
  branch?: WotSrcBranch,
): Promise<TankPostProgression | null> {
  return cachedInRedis(
    `wotsrc:post-progression:${region}${branch ? `:${branch}` : ""}:${tankId}`,
    WOTSRC_TTL_SECONDS,
    () => wg.region(region).source.postProgression.postProgression(tankId, branch),
  );
}

/**
 * A tank's field modifications (vehicle post progression): the tree resolved
 * from the vehicle's role (or its own special tree), each step's stat effects
 * from the client XML, and display names from the client localization. Returns
 * null below tier VI (no tree) or when wot-src has nothing for the tank.
 */
export function getTankFieldMods(
  region: Region,
  tankId: number,
  branch?: WotSrcBranch,
): Promise<TankFieldMods | null> {
  return cachedInRedis(`wotsrc:field-mods:${region}${branch ? `:${branch}` : ""}:${tankId}`, WOTSRC_TTL_SECONDS, () =>
    computeTankFieldMods(region, tankId, branch),
  );
}

async function computeTankFieldMods(
  region: Region,
  tankId: number,
  branch?: WotSrcBranch,
): Promise<TankFieldMods | null> {
  const src = wg.region(region).source.postProgression;
  // A test vehicle's tree lives on the CT branch alongside the vehicle itself.
  const pp = await getTankPostProgression(region, tankId, branch);
  if (!pp || pp.steps.length === 0) return null;
  const [names, titles] = await Promise.all([
    src.names(),
    src.nodeTitles(branch),
  ]);
  const assets = assetsBase(branch);

  const item = (m: PostProgressionModification): FieldModItem => ({
    key: m.key,
    name: names[`${m.locName}/name`] ?? m.locName,
    // Only pair sides have a client icon (base steps render as level chevrons).
    image: m.imgName
      ? `${assets}/pairModifications/80x80/${m.imgName}.png`
      : null,
    effects: m.modifiers,
  });

  const steps: FieldModStep[] = [];
  for (const step of pp.steps) {
    if (step.action === PostProgressionAction.Feature) {
      steps.push({
        level: step.level,
        kind: "feature",
        feature: {
          key: step.value,
          name: titles[step.value]?.name ?? step.value,
          description: titles[step.value]?.description || null,
          image: featureImage(assets, step.value),
        },
        modification: null,
        pair: null,
      });
    } else if (step.action === PostProgressionAction.Modification) {
      const m = pp.modifications[step.value];
      if (!m) continue;
      steps.push({
        level: step.level,
        kind: "modification",
        feature: null,
        modification: item(m),
        pair: null,
      });
    } else {
      const p = pp.pairs[step.value];
      const first = p && pp.modifications[p.first];
      const second = p && pp.modifications[p.second];
      if (!p || !first || !second) continue;
      steps.push({
        level: step.level,
        kind: "pair",
        feature: null,
        modification: null,
        pair: { key: p.key, first: item(first), second: item(second) },
      });
    }
  }
  steps.sort((a, b) => a.level - b.level);

  return { treeKey: pp.treeKey, steps };
}

/**
 * The modifications a packed `vehPostProgression` stands for.
 *
 * A replay's header carries each vehicle's field modifications as a short
 * array of integers, which is how the client puts them on the wire. Unpacking
 * is `packPostProgression` read backwards: the tree's steps sorted by id, two
 * bits for a pair (1 took the first side, 2 the second, 0 neither) and one bit
 * for everything else, the whole run split into 28-bit words that each carry a
 * `BIT_PACK` tag in their low nibble.
 *
 * Every step consumes its bits whether or not this code knows what it is. A
 * step type added by a later patch and skipped here would shift every bit
 * after it, and the result would be a plausible set of modifications that the
 * player never took.
 *
 * `BigInt`, because the run is longer than a machine word: three words is 84
 * bits, and JavaScript's bitwise operators would silently work on the low 32.
 * Written as `BigInt(n)` rather than `0n`, which this package's target forbids.
 */
export function unpackFieldMods(
  packed: readonly number[],
  steps: readonly PostProgressionStep[],
): { level: number; pairs: { name: string; side: "first" | "second" }[] } {
  /** `ACTION_TYPES.BIT_PACK`, the tag a packed word carries. */
  const BIT_PACK = 4;
  /** The client packs 28 bits to a word, above the four the tag takes. */
  const WORD = BigInt(28);

  let bits = BigInt(0);
  packed.forEach((word, at) => {
    if ((word & 0xf) !== BIT_PACK) return;
    bits |= BigInt(word >>> 4) << (WORD * BigInt(at));
  });

  const pairs: { name: string; side: "first" | "second" }[] = [];
  // The RANK reached, which is the highest level any taken step sits at --
  // not how many steps were taken. The two differ because a rank can hold
  // several steps, and the garage reports the rank: counting steps gave nine
  // where the same vehicle's own page said six.
  let level = 0;
  let pos = BigInt(0);
  for (const step of [...steps].sort((a, b) => a.id - b.id)) {
    const took = (taken: boolean) => {
      if (taken && step.level > level) level = step.level;
    };
    if (step.action === PostProgressionAction.PairModification) {
      const side = Number((bits >> pos) & BigInt(3));
      pos += BigInt(2);
      took(side === 1 || side === 2);
      if (side === 1 || side === 2) {
        pairs.push({ name: step.value, side: side === 1 ? "first" : "second" });
      }
    } else {
      took(Boolean((bits >> pos) & BigInt(1)));
      pos += BigInt(1);
    }
  }
  return { level, pairs };
}

/** One slot of a vehicle's field modifications, taken or not. */
export interface FieldModSlot {
  /**
   * Whether this pair was resolved.
   *
   * Every pair the tree offers is returned, not only the chosen ones, so a
   * reader can see three OF HOW MANY. Three modifications out of three is a
   * finished tree and three out of seven is a third of one, and a row that
   * drew only the three said nothing about which.
   */
  taken: boolean;
  /** The catalogue key, which is what the client's dictionary translates. */
  key: string | null;
  /** Wargaming's own name, English on this region; the fallback. */
  name: string | null;
  image: string | null;
}

/**
 * The modifications a packed value stands for, named and pictured.
 *
 * The one place that turns a replay's integers into something drawable, so the
 * battle row and the battle panel cannot drift. Two catalogue reads, both
 * cached and both about the VEHICLE rather than the battle: the raw tree for
 * the step ids the unpacking walks, and the resolved one for the names and
 * pictures, which only it knows -- a pair's key says nothing about which side
 * is which or what either looks like.
 *
 * Empty when the vehicle has no tree, which is every vehicle below tier X.
 */
export async function fieldModSlots(
  region: Region,
  tankId: number,
  packed: readonly number[],
  branch?: WotSrcBranch,
): Promise<FieldModSlot[]> {
  if (packed.length === 0) return [];
  const [raw, resolved] = await Promise.all([
    getTankPostProgression(region, tankId, branch),
    getTankFieldMods(region, tankId, branch),
  ]);
  if (!raw || !resolved) return [];

  const { pairs } = unpackFieldMods(packed, raw.steps);
  const took = new Map(pairs.map((pair) => [pair.name, pair.side]));
  const out: FieldModSlot[] = [];
  // Every pair the tree offers, in the tree's own order rather than the order
  // the chosen ones came back in. Two things follow from that: a reader sees
  // how many were available and not only how many were taken, and two players
  // on one vehicle show their modifications in the same places, so the rows
  // can be compared position by position.
  for (const step of resolved.steps) {
    if (!step.pair) continue;
    const side = took.get(step.pair.key);
    if (!side) {
      out.push({ taken: false, key: null, name: null, image: null });
      continue;
    }
    const item = side === "first" ? step.pair.first : step.pair.second;
    out.push({ taken: true, key: item.key, name: item.name, image: item.image });
  }
  return out;
}
