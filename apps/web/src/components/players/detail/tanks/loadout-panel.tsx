import {
  iconUrl,
  isSkillTree,
  premiumShellShare,
  type LoadoutCrewMember,
  type StoredPlayerLoadout,
} from "@unicum.gg/shared";
import { crewRoleBadgeUrl, isRegion, type Region } from "@unicum.gg/wargaming";
import {
  crewSkillIcon,
  loadoutIcons,
  type LoadoutIcon,
} from "@unicum.gg/core/tanks/loadout-icons";
import { getTankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import { getTankFieldMods } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import { localizeBuild } from "@/components/tanks/detail/localize-build";
import {
  CrewGroup,
  Group,
  LoadoutTooltips,
  ShellGroup,
  SlotGroup,
  type LoadoutCrewView,
  type LoadoutSlotView,
} from "@/components/players/detail/tanks/loadout-boxes";
import { gradeOverlay } from "@/components/players/detail/tanks/loadout-marks";
import { getTranslation } from "@/lib/translations.server";
import { RelativeTime } from "@/components/relative-time";
import { PuzzlePieceIcon } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import Link from "@/components/link";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { styles } from "@/lib/styles";

// WG's own shell-type pictures, from our assets mirror, keyed by the kind of
// round the client reports. The same ones the tank page's ammo panel draws.
const AMMO_ICONS = iconUrl("ammopanel/ammo");

/**
 * How this player has set this vehicle up.
 *
 * A **server** component, and everything it does is naming: the catalogues
 * that name equipment, consumables, directives, crew perks and roles in the
 * reader's own language are stripped before the dictionaries cross the wire
 * (`SERVER_ONLY_NAMESPACES`), so a client component asking for one gets its
 * key back. What it hands down is finished text and finished URLs.
 *
 * The boxes themselves are drawn by `loadout-boxes.tsx`, which is a client
 * component because a tooltip is interaction. That split is load-bearing
 * rather than tidy: rendering the tooltips from here cost the server
 * rendering of everything they wrapped, measured at one box out of
 * forty-seven, the rest appearing only once hydration had run.
 *
 * It reads as the tank page's own build does, because it is the same thing
 * seen from the other side: that page asks what a vehicle CAN mount, this one
 * shows what one player DID.
 */
export async function PlayerTankLoadoutPanel({
  loadout,
  region,
  locale,
}: {
  loadout: StoredPlayerLoadout;
  region: string;
  locale: string;
}) {
  const [
    { t: tEquipment },
    { t: tPerks },
    { t: tRoles },
    { t: tGame },
    { t },
    icons,
    tankCrew,
    tankFieldMods,
  ] = await Promise.all([
    getTranslation("game/equipment", locale),
    getTranslation("game/crew-perks", locale),
    getTranslation("game/crew-roles", locale),
    getTranslation("game/vocabulary", locale),
    getTranslation("components/players/detail/tanks/loadout-panel", locale),
    isRegion(region)
      ? loadoutIcons(region as Region, loadout.tankId)
      : Promise.resolve(new Map<string, LoadoutIcon>()),
    // The vehicle's own crew, which is a fact about the tank rather than about
    // the player: the seats it HAS, and which role each perk belongs to. Both
    // are needed. Without the seats an unmanned vehicle draws no crew at all,
    // and "nobody in it" reads exactly like "we were never told"; without the
    // perks' roles a member's skills run on as one undifferentiated row.
    isRegion(region)
      ? getTankCrew(region as Region, loadout.tankId)
      : Promise.resolve(null),
    // The vehicle's own post-progression tree, which is what turns "level 6
    // and three pairs" into the picture the tank page draws. A fact about the
    // tank, like its crew seats, so it is fetched the same way.
    isRegion(region)
      ? getTankFieldMods(region as Region, loadout.tankId)
      : Promise.resolve(null),
  ]);

  const seats = tankCrew?.members.map((member) => member.roles) ?? [];
  // Which role owns each perk: `common` for the three every member can learn,
  // otherwise the role that teaches it.
  const perkRole = new Map(tankCrew?.skills.map((skill) => [skill.key, skill.role]));

  // Every setup, not only the one in use: a second setup is a build the
  // player deliberately keeps, and showing one of two said nothing about
  // which. The groups carry their own active index because the client lets
  // them switch independently.
  const ammoGroup = loadout.setups?.ammo;
  const devicesGroup = loadout.setups?.devices;
  const ammoLayouts = ammoGroup?.layouts ?? [];
  const deviceLayouts = devicesGroup?.layouts ?? [];

  /**
   * One slot, named and pictured.
   *
   * The catalogue names a device as Wargaming does and the dictionary names
   * it as the game's own client does. They agree, and where the catalogue has
   * nothing the dictionary still answers, so it is the fallback rather than
   * the other way round: only the catalogue carries a picture.
   */
  const slot = (key: string | null): LoadoutSlotView => {
    if (!key) return { name: null, image: null };
    const entry = icons.get(key);
    return {
      name: entry?.name || tEquipment(key),
      image: entry?.image ?? null,
      overlay: gradeOverlay(entry),
      categories: entry?.categories,
    };
  };

  const shellRows = ammoLayouts.map((layout) => ({
    shells: layout.shells.map((shell) => ({
      id: shell.id,
      // AP, APCR, HEAT, HE, in the reader's language. The same block the tank
      // page's own module nodes read, so the two pages call a round the same.
      kind: tGame(`shells.${shell.type}`) || shell.type,
      count: shell.count,
      premium: shell.premium,
      image: `${AMMO_ICONS}/${shell.type}.png`,
    })),
    goldPercent: (() => {
      const share = premiumShellShare(layout);
      return share === null ? null : Math.round(share * 100);
    })(),
  }));

  /**
   * One row per seat the vehicle has, whoever is sitting in it.
   *
   * Joined by role rather than by position: what the mod sends is the members
   * it found, and a vehicle with a gap in its crew sends a shorter list than
   * it has seats, so index two on one side is not index two on the other. A
   * role names a seat well enough, and where two seats share one (a second
   * loader) either of them will do, since both draw the same badge.
   *
   * An unclaimed seat is drawn rather than dropped. The mod already fills the
   * seats of a vehicle whose crew is off driving another one, reading the
   * crew that last took it into battle, so a seat still empty here is a seat
   * the player has genuinely never put anybody in.
   */
  const waiting = new Map<string, LoadoutCrewMember[]>();
  for (const member of loadout.crew ?? []) {
    const queue = waiting.get(member.role);
    if (queue) queue.push(member);
    else waiting.set(member.role, [member]);
  }
  const rows = seats.length
    ? seats.map((roles) => ({
        roles,
        member: waiting.get(roles[0] ?? "crew")?.shift(),
      }))
    : // A vehicle whose composition we cannot read: fall back to what the
      // player sent, which is the only thing we know about its crew.
      (loadout.crew ?? []).map((member) => ({
        roles: [member.role],
        member,
      }));

  /**
   * A member's perks, broken into lines the way the tank page breaks them.
   *
   * The three universal perks first, then one line per role the member fills
   * (a commander who also works the radio gets a commander line and a radio
   * line), then anything the catalogue did not place, so nothing is dropped.
   * Run together on one line they read as a single undifferentiated pile,
   * which is not how the game presents them or how a player thinks of them.
   */
  const perkLines = (skills: string[] | undefined, roles: string[]) => {
    const placed = new Set<string>();
    const take = (role: string) => {
      const keys = (skills ?? []).filter(
        (key) => !placed.has(key) && perkRole.get(key) === role,
      );
      keys.forEach((key) => placed.add(key));
      return keys;
    };
    const lines: { key: string; skills: string[] }[] = [];
    for (const role of ["common", ...roles]) {
      const keys = take(role);
      if (keys.length) lines.push({ key: role, skills: keys });
    }
    const rest = (skills ?? []).filter((key) => !placed.has(key));
    if (rest.length) lines.push({ key: "other", skills: rest });
    return lines.map((line) => ({
      key: line.key,
      skills: line.skills.map((name) => ({
        name: tPerks(name),
        image: crewSkillIcon(name),
      })),
    }));
  };

  const crew: LoadoutCrewView[] = rows.map(({ roles, member }) => ({
    // Both roles, as the garage names the seat: "Commander / Radio Operator".
    role: roles.map((role) => tRoles(role)).join(" / "),
    empty: !member,
    emptyLabel: t("seat-empty"),
    roleImage: isRegion(region)
      ? crewRoleBadgeUrl(region as Region, roles[0] ?? "crew")
      : null,
    skillLines: perkLines(member?.skills, roles),
  }));

  const progression = loadout.progression;
  // The tree, named in the reader's language by the same helper the tank page
  // uses, so a modification is called the same thing on both.
  const { fieldMods: tree } = localizeBuild(
    { loadout: null, crew: null, fieldMods: tankFieldMods, skillTree: null },
    { equipment: tEquipment, perks: tPerks },
  );

  /**
   * The modifications actually taken, as slots.
   *
   * Boxes and not the tank page's tree. The tree is a thing to CHOOSE from: it
   * draws every rank and both sides of every pair so a reader can pick. This
   * panel reports what one player runs, which is three or four items, and the
   * same box the equipment above it uses says that in a line instead of a
   * widget the height of the rest of the panel.
   *
   * The picture and the name still come from the tree, which is the only place
   * that knows which side of a pair a key names and what it looks like.
   */
  const fieldModSlots: LoadoutSlotView[] = [];
  if (progression && !isSkillTree(progression)) {
    const taken = new Map(progression.pairs.map((p) => [p.name, p.side]));
    for (const step of tree?.steps ?? []) {
      if (!step.pair) continue;
      const side = taken.get(step.pair.key);
      if (!side) continue;
      const item = side === "first" ? step.pair.first : step.pair.second;
      fieldModSlots.push({
        filled: true,
        name: item.name,
        image: item.image,
      });
    }
  }
  const fieldModLevel =
    progression && !isSkillTree(progression) ? progression.level : null;

  return (
    <LoadoutTooltips>
      {/* No padding and no rule of its own: the panel's body already carries
          `p-4` and spaces its sections with `gap-4`, so a second inset here
          pushed this one block further in than every block above it, and a
          separator drawn on top of that spacing read as a stray line rather
          than as a division. The heading is what opens the section. */}
      <section>
        <header className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("title")}</h3>
          <span className="text-xs text-fd-muted-foreground">
            <RelativeTime date={loadout.updatedAt} />
          </span>
        </header>

        {/* The four things a tank carries into battle, side by side rather
            than stacked: they are read together, and four rows of three boxes
            filled the panel with more label than content. Wraps group by
            group on a narrow screen. */}
        <div className="mb-4 flex flex-wrap items-start gap-x-5 gap-y-3">
          {deviceLayouts.length > 0 ? (
            <SlotGroup
              label={t("equipment")}
              layouts={deviceLayouts.map((layout) =>
                layout.optDevices.map(slot),
              )}
              active={devicesGroup?.active ?? 0}
            />
          ) : null}
          {/* Whenever the vehicle HAS the slots, not whenever the player
              filled one. Carrying no directive is a decision like carrying no
              standard AP, and hiding the row made "they run none" look
              exactly like "this vehicle takes none". The only reason to draw
              nothing is a vehicle with no such slot at all. */}
          {deviceLayouts.some((layout) => layout.boosters.length > 0) ? (
            <SlotGroup
              label={t("directives")}
              layouts={deviceLayouts.map((layout) => layout.boosters.map(slot))}
              active={devicesGroup?.active ?? 0}
            />
          ) : null}
          {ammoLayouts.length > 0 ? (
            <SlotGroup
              label={t("consumables")}
              layouts={ammoLayouts.map((layout) =>
                layout.consumables.map(slot),
              )}
              active={ammoGroup?.active ?? 0}
            />
          ) : null}
          {shellRows.some((row) => row.shells.length > 0) ? (
            <ShellGroup
              label={t("ammo")}
              layouts={shellRows}
              active={ammoGroup?.active ?? 0}
            />
          ) : null}
        </div>

        {crew.length > 0 ? <CrewGroup label={t("crew")} crew={crew} /> : null}

        {fieldModSlots.length ? (
          <SlotGroup
            label={`${t("field-mods")}${fieldModLevel ? ` ${fieldModLevel}` : ""}`}
            layouts={[fieldModSlots]}
            active={0}
          />
        ) : null}

      </section>
    </LoadoutTooltips>
  );
}

/**
 * The same section, for a vehicle whose setup nobody has shared.
 *
 * Shown rather than hidden, because the absence is the interesting part: the
 * game publishes nothing about how a tank is equipped, so this section exists
 * at all only because the mod reads it. A panel that simply vanished left the
 * reader to conclude the vehicle carries nothing, and told nobody where the
 * filled version comes from.
 *
 * One line, deliberately: it stands where a filled panel would, on a page that
 * is already dense, so it says the one thing and offers the one link. The
 * house button and a hint of the brand tint are enough to mark it as an offer
 * rather than an error.
 */
export async function PlayerTankLoadoutEmpty({ locale }: { locale: string }) {
  const { t } = await getTranslation(
    "components/players/detail/tanks/loadout-panel",
    locale,
  );
  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
      </header>
      <div
        className={`flex flex-col items-start gap-3 rounded-lg ${styles.cardBorder} bg-fd-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}
      >
        <p className={`${styles.mutedText} text-xs leading-relaxed`}>
          {t("empty-blurb", { name: APP.NAME })}
        </p>
        <Link
          href={ROUTES.MOD}
          className={`${buttonVariants({ variant: "primary", size: "sm" })} shrink-0`}
        >
          <PuzzlePieceIcon weight="fill" className="mr-1.5 size-3.5" />
          {t("empty-cta")}
        </Link>
      </div>
    </section>
  );
}
