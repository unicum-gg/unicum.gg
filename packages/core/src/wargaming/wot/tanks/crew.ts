import { crewFaceUrl, crewRoleBadgeUrl, Region } from "@unicum.gg/wargaming";
import { crewSkillAffectsSpec, iconUrl } from "@unicum.gg/shared";
import { wg } from "../../client";
import { cachedInRedis } from "../../../redis";

// wot-src/WG data changes only on a game patch (refreshed daily by
// vehicles-cron); the parsed result is cached in Redis for a day (shared across
// instances, surviving deploys).
const WOTSRC_TTL_SECONDS = 24 * 60 * 60;

/** A crew skill's passive effect on a characteristic: `attribute` is the wot-src
 * param name (the front maps it to a spec field), `value` the per-skill-level
 * magnitude. Only non-situational effects that move a displayed characteristic
 * are kept. */
export interface CrewSkillEffect {
  attribute: string;
  value: number;
}

/** A crew skill in the catalogue: its display identity from WG (`crewskills`),
 * its owning role from WG (`crewroles`), and its spec effects from the wot-src
 * client XML, all bridged by the shared `skill` string key. */
export interface CrewSkill {
  key: string;
  name: string;
  image: string | null;
  description: string;
  isPerk: boolean;
  /** Owning role (`commander`, ...) or `common` for a universal skill. */
  role: string;
  effects: CrewSkillEffect[];
  /** Crew-training-level bonus in level points (Brothers in Arms = 5), 0 for a
   * normal skill. Applied to every crew-affected characteristic rather than a
   * single one, via the game's `0.57 + 0.43 * level` role factor. */
  crewLevel: number;
  /** The Camouflage skill (has a `maskingFactor` effect): scales the camo values
   * by the same `0.57 + 0.43 * level` factor, applied to camo, not one stat. */
  camouflage: boolean;
}

/** A crew member of the vehicle: its slot id, the role(s) it fills (a member can
 * cover several, e.g. commander + gunner), and the skill keys it can learn. */
export interface CrewMember {
  memberId: string;
  roles: string[];
  /** The member's nation portrait (WG tankopedia crew face), by slot position. */
  image: string | null;
  /** The role badge (its primary role) overlaid on the portrait. */
  roleBadge: string | null;
  /** Skill keys available to this member (its roles' skills + universal), in the
   * in-game display order; each references an entry in `TankCrew.skills`. */
  skills: string[];
}

/** A tank's crew: its members and the full skill catalogue they draw from. */
export interface TankCrew {
  members: CrewMember[];
  skills: CrewSkill[];
}

// WG's own `crewskills` image_url points at a stale static path that 404s since
// the crew rework, so the skill icon is taken from the wot.assets mirror by the
// skill key (its filename), keeping the icon source generated (no per-skill map).
const SKILL_ICON_BASE = iconUrl("tankmen/skills/big");
const skillIcon = (key: string): string => `${SKILL_ICON_BASE}/${key}.png`;

/**
 * A tank's crew composition (from the wot-src client XML `<crew>`) and the
 * crew-skill catalogue: the localized name/icon/description (WG `crewskills`)
 * and owning role (WG `crewroles`) bridged to the per-level effects (wot-src
 * `tankmen.xml`) by the shared `skill` string key. Fully derived, no
 * hand-maintained mapping. The composition comes from wot-src so tanks WG's
 * encyclopedia omits still have a crew; the skill catalogue is a global WG read.
 * Returns null when wot-src has no crew for the vehicle.
 */
export function getTankCrew(
  region: Region,
  tankId: number,
): Promise<TankCrew | null> {
  return cachedInRedis(`wotsrc:crew:${region}:${tankId}`, WOTSRC_TTL_SECONDS, () =>
    computeTankCrew(region, tankId),
  );
}

async function computeTankCrew(
  region: Region,
  tankId: number,
): Promise<TankCrew | null> {
  const r = wg.region(region);
  const [composition, roles, skillsApi, skillDefs] = await Promise.all([
    // Composition + nation from the wot-src client XML, so tanks WG's
    // encyclopedia omits (special/reward) still show their crew. The skill
    // catalogue below stays WG (`crewroles`/`crewskills`): it is global, not
    // per-vehicle, so it resolves for every tank regardless.
    r.source.specs.crew(tankId),
    r.api.wot.encyclopedia.crewroles({}),
    r.api.wot.encyclopedia.crewskills({}),
    r.source.crew.skills(),
  ]);

  if (!composition || composition.members.length === 0) return null;

  // Each skill's spec-affecting effects (non-situational, mapping a displayed
  // characteristic), keyed by the skill string id.
  // Commander "special" abilities are innate defaults the game grants for free
  // (Sixth Sense, made a free default in 1.18.1), not trainable skills, so they
  // are dropped from the catalogue and from every member's skill list.
  const specialKeys = new Set(
    skillDefs.filter((d) => d.special).map((d) => d.key),
  );

  const effectsByKey = new Map<string, CrewSkillEffect[]>();
  const crewLevelByKey = new Map<string, number>();
  const camoByKey = new Map<string, boolean>();
  // The skill's name + description from the client's own perk localization
  // (`crew_perks.po`), complete where WG's `crewskills` returns null or a stale
  // string; the WG value is only a fallback.
  const nameByKey = new Map<string, string>();
  const descByKey = new Map<string, string>();
  for (const d of skillDefs) {
    effectsByKey.set(
      d.key,
      d.effects
        .filter((e) => !e.situational && crewSkillAffectsSpec(e.param))
        .map((e) => ({ attribute: e.param, value: e.value })),
    );
    crewLevelByKey.set(d.key, d.crewLevelIncrease);
    camoByKey.set(d.key, d.effects.some((e) => e.param === "maskingFactor"));
    if (d.name) nameByKey.set(d.key, d.name);
    if (d.description) descByKey.set(d.key, d.description);
  }

  // role -> ordered skill keys, and each skill's owning role (a skill listed
  // under every role is a universal one, tagged `common`).
  const roleSkillKeys = new Map<string, string[]>();
  const roleOfSkill = new Map<string, string>();
  for (const [role, def] of Object.entries(roles)) {
    const keys = Array.isArray(def.skills) ? def.skills : [];
    roleSkillKeys.set(role, keys);
    for (const k of keys) {
      const held = roleOfSkill.get(k);
      roleOfSkill.set(k, held && held !== role ? "common" : (held ?? role));
    }
  }

  const skills: CrewSkill[] = [];
  const known = new Set<string>();
  for (const [key, s] of Object.entries(skillsApi)) {
    if (specialKeys.has(key)) continue;
    known.add(key);
    skills.push({
      key,
      name: nameByKey.get(key) ?? s.name,
      image: skillIcon(key),
      description: descByKey.get(key) ?? s.description,
      isPerk: s.is_perk,
      role: roleOfSkill.get(key) ?? "common",
      effects: effectsByKey.get(key) ?? [],
      crewLevel: crewLevelByKey.get(key) ?? 0,
      camouflage: camoByKey.get(key) ?? false,
    });
  }

  const { nation, members: composed } = composition;
  const members: CrewMember[] = composed.map((memberRoles, i) => {
    const keys: string[] = [];
    const added = new Set<string>();
    for (const role of memberRoles) {
      for (const k of roleSkillKeys.get(role) ?? []) {
        if (!added.has(k) && known.has(k)) {
          added.add(k);
          keys.push(k);
        }
      }
    }
    return {
      // wot-src carries no member id, so key by primary role + slot position,
      // which is stable and unique within a crew.
      memberId: `${memberRoles[0] ?? "crew"}-${i}`,
      roles: memberRoles,
      image: nation ? crewFaceUrl(region, nation, i) : null,
      roleBadge: memberRoles[0] ? crewRoleBadgeUrl(region, memberRoles[0]) : null,
      skills: keys,
    };
  });

  return { members, skills };
}
