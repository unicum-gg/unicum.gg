// One player's medal cabinet: the whole Wargaming achievement catalogue joined
// with what the player actually earned.
//
// The catalogue is served in full (510 entries, 288 of them retired events)
// rather than trimmed to what the player has, because the interesting question
// is often the opposite one: what is still missing. Filtering that down is the
// UI's job, and it needs the unearned rows to do it.

/** One step of a tiered medal (Mastery Badge, Carius's Medal, Marks of
 * Excellence). Wargaming keeps the artwork per tier rather than on the parent,
 * which is why 46 catalogue entries have no image of their own. */
export type AchievementTier = {
  name: string;
  image: string;
};

/** A medal, as the player stands with it. */
export type PlayerAchievement = {
  /** Wargaming's stable id (`medalKolobanov`), also the image basename. */
  id: string;
  name: string;
  description: string;
  /** How it is earned. Multi-line in WG's data. */
  condition: string;
  /** The artwork. Wargaming serves a small and a big variant; only the big one
   * is carried, because it is the only one anything renders and the pair cost
   * 58 KB of every response for nothing. */
  image: string;
  /** Section id (`battle`, `epic`, …) and its display name, from WG. */
  section: string;
  sectionName: string;
  sectionOrder: number;
  /** Rank within the section, from WG. */
  order: number;
  /** WG's kind: `single`, `repeatable`, `class`, `custom`, `series`. Kept as a
   * plain string rather than an enum because it is Wargaming's vocabulary, not
   * ours, and a new value must not break the join. */
  type: string;
  /** Retired: an event medal that can no longer be earned. */
  outdated: boolean;
  /** Tiers, in Wargaming's own order, which is NOT always ascending: Carius's
   * Medal runs Class I to IV while the Mastery Badge runs Class III to Ace.
   * Empty for an untiered medal. */
  tiers: AchievementTier[];
  /** For an untiered medal, how many times the player earned it. For a tiered
   * one (`tiers` non-empty) it is the 1-based index of the tier reached, so
   * `4` on the Mastery Badge is Ace, not "four badges". 0 means never earned. */
  count: number;
};

/** Wargaming names a tiered parent by interpolating the tier into a template,
 * which on the parent entry leaves the slot empty: `Mastery Badge: ""`. Drop
 * the dangling quotes rather than show them. */
function cleanName(name: string): string {
  return name.replace(/:\s*""\s*$/, "").trim();
}

/**
 * What to show for one medal: the artwork and label of the tier the player
 * reached, falling back to the parent entry for untiered medals and to the
 * best tier as a preview for a tiered one they have not earned yet.
 */
export function achievementFace(a: PlayerAchievement): {
  name: string;
  image: string;
  /** The tier label to badge the tile with, e.g. "Class I". Null when the medal
   * is untiered, where the badge shows the repeat count instead. */
  tierName: string | null;
} {
  if (a.tiers.length === 0) {
    return { name: cleanName(a.name), image: a.image, tierName: null };
  }
  // Unearned: preview the last tier. It is the one the parent entry's name
  // describes, and showing an empty slot for a whole family of medals reads as
  // a bug rather than as something left to earn.
  const tier = a.count > 0 ? a.tiers[a.count - 1] : a.tiers.at(-1);
  if (!tier) return { name: cleanName(a.name), image: a.image, tierName: null };
  return {
    name: cleanName(tier.name || a.name),
    image: tier.image || a.image,
    tierName: a.count > 0 ? cleanName(tier.name) || null : null,
  };
}

/**
 * Undo Wargaming's cosmetic line breaks without losing the meaningful ones.
 *
 * The strings are pre-wrapped for the game client's fixed-width panel, so they
 * arrive with hard breaks mid-sentence ("…in controlling an armored\nvehicle.
 * To qualify…"). Rendered as-is in a tooltip they wrap twice and stagger. But
 * some breaks carry structure: the bullet lists in `condition`, and the
 * indented enumerations in `description` ("Destroy enemy vehicles:\n    6 and
 * more — …").
 *
 * The rule: a break is real when the next line opens a new item — a bullet or
 * an indent. Anything else is the game client's wrapping, and the two lines are
 * one sentence.
 */
export function unwrapWgText(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    const isNewItem = /^[•\-]/.test(raw.trim()) || /^\s{2,}\S/.test(raw);
    if (lines.length === 0 || isNewItem) {
      lines.push(raw.trim());
    } else {
      lines[lines.length - 1] = `${lines[lines.length - 1]} ${raw.trim()}`.trim();
    }
  }
  return lines.filter(Boolean);
}

export type AchievementSection = {
  id: string;
  name: string;
  order: number;
  /** Distinct medals earned in this section, and how many exist. */
  earned: number;
  total: number;
};

export type PlayerAchievements = {
  achievements: PlayerAchievement[];
  sections: AchievementSection[];
  /** Distinct medals earned across the whole catalogue, and the catalogue size.
   * Counted on distinct medals, not on how many times each was earned: the
   * cabinet is "153 of 510", not "however many battle hero medals I racked up". */
  earned: number;
  total: number;
};

/** Completion as a 0..1 ratio; 0 when the catalogue failed to load. */
export function achievementCompletion(a: {
  earned: number;
  total: number;
}): number {
  return a.total > 0 ? a.earned / a.total : 0;
}
