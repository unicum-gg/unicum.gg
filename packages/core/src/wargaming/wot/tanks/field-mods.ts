import {
  PostProgressionAction,
  Region,
  type PostProgressionModification,
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
  const pp = await src.postProgression(tankId, branch);
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
