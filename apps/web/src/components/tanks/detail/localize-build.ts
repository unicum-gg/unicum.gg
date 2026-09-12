import type { TranslateFunction } from "@onruntime/translations";
import type { TankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { TankFieldMods } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { TankSkillTree } from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";

/**
 * A tank's build, in the words the reader's own client uses.
 *
 * Wargaming translates its equipment, consumables, directives, field
 * modifications and crew skills into every language it publishes the game in,
 * and the payload already carries the client's key beside the English name
 * (measured: 138 of a IS-7's 143 keyed items resolve against the catalogues). So
 * this renames the three payloads once and every panel below reads a localized
 * name with no change of its own.
 *
 * Called on the SERVER, from the specifications tab, for the same reason the map
 * blurbs are: `game/equipment` and `game/crew-perks` are 21 KB the browser would
 * otherwise carry on every page of the site to render a tank page. Doing it here
 * keeps them off the wire entirely (see `SERVER_ONLY_NAMESPACES`).
 */
type Named = {
  key: string;
  name: string;
  description?: string | null;
  /** The catalogue entry the blurb came from, when it is not this item's own
   * key: a grade variant carries the base device's. */
  descriptionKey?: string;
};

/**
 * The catalogues each half of the build is named and explained from.
 *
 * An object rather than a tail of positional arguments: there are seven of them
 * and five are optional, so a call site was a column of bare identifiers whose
 * meaning was their position, and adding one meant counting commas.
 */
export type BuildCatalogues = {
  equipment: TranslateFunction;
  perks: TranslateFunction;
  equipmentDescriptions?: TranslateFunction;
  perkDescriptions?: TranslateFunction;
  featureDescriptions?: TranslateFunction;
  /** The upgrade tree's node titles, and the sentence under each. */
  skillTree?: TranslateFunction;
  skillTreeDescriptions?: TranslateFunction;
};

export function localizeBuild<
  L extends TankLoadout | null,
  C extends TankCrew | null,
  F extends TankFieldMods | null,
  S extends TankSkillTree | null,
>(
  { loadout, crew, fieldMods, skillTree }: {
    loadout: L;
    crew: C;
    fieldMods: F;
    skillTree: S;
  },
  t: BuildCatalogues,
) {
  const {
    equipment: tEquipment,
    perks: tPerks,
    equipmentDescriptions: tEquipmentDescriptions,
    perkDescriptions: tPerkDescriptions,
    featureDescriptions: tFeatureDescriptions,
    skillTree: tSkillTree,
    skillTreeDescriptions: tSkillTreeDescriptions,
  } = t;
  // A key with no entry returns itself, which is how a name the catalogue does
  // not carry keeps the English the payload came with. The blurb is renamed the
  // same way and from the same catalogue: naming a device in French and then
  // explaining it in English is half a translation.
  const rename =
    (t: TranslateFunction, tDescription?: TranslateFunction) =>
    <T extends Named>(item: T): T => {
      const name = t(item.key);
      // The blurb is looked up by the entry it CAME from, not by the device:
      // "Bounty Rammer" carries `trophyBasicTankRammer`'s sentence, and looking
      // it up under `deluxRammer` finds nothing and leaves the English.
      const descriptionKey = item.descriptionKey || item.key;
      const description = tDescription?.(descriptionKey);
      const next = { ...item };
      if (name !== item.key) next.name = name;
      if (description && description !== descriptionKey) {
        next.description = description;
      }
      return next.name === item.name && next.description === item.description
        ? item
        : next;
    };
  const equip = rename(tEquipment, tEquipmentDescriptions);
  const perk = rename(tPerks, tPerkDescriptions);
  // A field modification's alternative-loadout feature is named in the
  // equipment catalogue but explained in the upgrade tree's.
  const feature = rename(tEquipment, tFeatureDescriptions);

  return {
    loadout: loadout
      ? {
          ...loadout,
          equipment: loadout.equipment.map(equip),
          directives: loadout.directives.map(equip),
          consumables: loadout.consumables.map(equip),
        }
      : loadout,
    crew: crew ? { ...crew, skills: crew.skills.map(perk) } : crew,
    fieldMods: fieldMods
      ? {
          ...fieldMods,
          steps: fieldMods.steps.map((step) => ({
            ...step,
            feature: step.feature ? feature(step.feature) : step.feature,
            // A base modification is keyed by its slot
            // (`role_heavyTank_base_1`) rather than by the name it shows, and
            // the client names it under a `locName` the payload does not carry,
            // so it keeps English until that field is added.
            modification: step.modification,
            pair: step.pair
              ? {
                  ...step.pair,
                  first: equip(step.pair.first),
                  second: equip(step.pair.second),
                }
              : step.pair,
          })),
        }
      : fieldMods,
    // A node is named and explained by the same client key, which the payload
    // carries as `nameKey` rather than `key`: it is not an item you mount, it
    // is a step of the tree, so it has no catalogue key of its own.
    skillTree:
      skillTree && (tSkillTree || tSkillTreeDescriptions)
        ? {
            ...skillTree,
            nodes: skillTree.nodes.map((node) =>
              renameNode(node, tSkillTree, tSkillTreeDescriptions),
            ),
          }
        : skillTree,
  };
}

function renameNode<
  T extends {
    nameKey: string;
    name: string;
    description: string | null;
    descriptionValue?: number | null;
  },
>(node: T, tName?: TranslateFunction, tDescription?: TranslateFunction): T {
  // A payload cached before the field existed carries no key, and reads as the
  // English it already came with rather than throwing on it.
  if (!node.nameKey) return node;
  const name = tName?.(node.nameKey);
  const description = tDescription?.(node.nameKey);
  const next = { ...node };
  if (name && name !== node.nameKey) next.name = name;
  if (description && description !== node.nameKey) {
    next.description = fillValue(description, node.descriptionValue);
  }
  return next.name === node.name && next.description === node.description
    ? node
    : next;
}

/**
 * The client writes the number into its own sentence, and so do we.
 *
 * The hole is `{value}` in every language, since the catalogues are one string
 * translated rather than one per language, so this is a substitution and not a
 * format. A sentence with a hole and nothing to put in it loses the hole too:
 * "by  %." is a sentence with a gap where a reader looks for a figure, and
 * "increases ramming damage" without one at least says something true.
 */
const VALUE_HOLE = /\s*\{value\}\s*/g;

function fillValue(sentence: string, value: number | null | undefined): string {
  if (!sentence.includes("{value}")) return sentence;
  return value == null
    ? sentence.replace(VALUE_HOLE, " ").replace(/\s+([.,;:%])/g, "$1").trim()
    : sentence.replace(/\{value\}/g, String(value));
}
