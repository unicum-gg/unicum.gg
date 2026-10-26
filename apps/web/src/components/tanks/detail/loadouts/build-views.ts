import {
  itemsOfKind,
  LoadoutItemKind,
} from "@unicum.gg/shared";
import type { LoadoutNaming } from "./naming";
import type { PlayerBattleRow } from "@/components/players/detail/overview/battles-table";
import type {
  CrewSeatRows,
  LoadoutTableRow,
  RowIcon,
  TankLoadoutsPayload,
  TopPlayerRow,
} from "./view";

/**
 * The payload, named and shaped into what each panel draws.
 *
 * Kept out of the tab itself because it runs once per mode, and because it
 * is all mapping: the panels take finished text and finished URLs, and this is
 * the one place a client key is turned into either.
 *
 * Two shapes of row come out of it, and which family gets which is a real
 * distinction rather than a convenience. Equipment, consumables and field
 * modification trees are decided as a SET, so they are counted whole and a row
 * carries every picture of it. Directives are picked one at a time.
 */
export function buildViews(stats: TankLoadoutsPayload, naming: LoadoutNaming) {
  /** The families counted as whole setups: one row, three pictures. */
  const setups = (kind: LoadoutItemKind): LoadoutTableRow[] =>
    stats.setups
      .filter((setup) => setup.kind === kind)
      .map((setup) => ({
        // The sorted list is already the group's identity, so it is also a
        // stable React key: two setups cannot share one.
        key: setup.items.join("|"),
        icons: setup.items.map((item) => icon(item, kind, naming)),
        count: setup.count,
        battles: setup.battles,
        share: setup.share,
        performance: setup.performance,
      }));

  /** The families counted one at a time: one row, one picture. */
  const items = (kind: LoadoutItemKind): LoadoutTableRow[] =>
    itemsOfKind(stats.items, kind).map((item) => ({
      key: item.key,
      icons: [icon(item.key, kind, naming)],
      count: item.count,
      battles: item.battles,
      share: item.share,
      performance: item.performance,
    }));

  return {
    equipment: setups(LoadoutItemKind.Equipment),
    consumables: setups(LoadoutItemKind.Consumable),
    directives: items(LoadoutItemKind.Directive),
    fieldMods: setups(LoadoutItemKind.FieldMod),
    crew: crewRows(stats, naming),
    topPlayers: topPlayerRows(stats, naming),
    topBattles: topBattleRows(stats),
  };
}

/**
 * One key, pictured and named.
 *
 * A field modification is keyed by the side of the pair taken, which the
 * vehicle's own tree names and pictures, so it goes through its own lookup.
 */
function icon(
  key: string,
  kind: LoadoutItemKind,
  naming: LoadoutNaming,
): RowIcon {
  if (kind === LoadoutItemKind.FieldMod) return naming.fieldMod(key);
  const named = naming.item(key);
  return {
    name: named.name,
    image: named.image,
    overlay: named.overlay,
    categories: named.categories,
  };
}

/**
 * The crew skills, a table per seat.
 *
 * Ordered by the vehicle's own crew composition rather than by how many skills
 * each seat happens to have, so the commander leads and the seats read in the
 * order the garage shows them. A seat the payload carries that the catalogue
 * did not list is still drawn, at the end: dropping it would silently lose
 * every skill on it.
 */
function crewRows(
  stats: TankLoadoutsPayload,
  naming: LoadoutNaming,
): CrewSeatRows[] {
  const bySeat = new Map<string, { crews: number; rows: LoadoutTableRow[] }>();
  for (const entry of stats.crewSkills) {
    const named = naming.crewSkill(entry.skill);
    const seat = bySeat.get(entry.role) ?? { crews: entry.crews, rows: [] };
    bySeat.set(entry.role, seat);
    seat.rows.push({
      key: entry.skill,
      icons: [{ name: named.name, image: named.image }],
      count: entry.count,
      battles: entry.battles,
      share: entry.share,
      performance: entry.performance,
    });
  }

  const ordered = [
    ...naming.seats.filter((role) => bySeat.has(role)),
    ...[...bySeat.keys()].filter((role) => !naming.seats.includes(role)),
  ];
  // A vehicle seating the same role twice names it twice, and the skills under
  // it are one set, so the second mention would draw the whole table again.
  return [...new Set(ordered)].flatMap((role) => {
    const seat = bySeat.get(role);
    if (!seat || seat.rows.length === 0) return [];
    return [
      {
        role,
        roleLabel: naming.role(role).label,
        roleImage: naming.role(role).image,
        crews: seat.crews,
        rows: seat.rows,
      },
    ];
  });
}

/**
 * The best battles, as battle rows that name their player: the card then leads
 * with the player rather than the vehicle, which every row shares.
 *
 * The identity is built literally rather than through `identityFromRow`: the
 * payload is camelCase, and that helper reads snake_case on purpose.
 */
export function topBattleRows(
  stats: Pick<TankLoadoutsPayload, "topBattles">,
): PlayerBattleRow[] {
  return stats.topBattles.map(({ player, battle }) => ({
    ...battle,
    player: {
      accountId: player.accountId,
      identity: {
        nickname: player.nickname,
        accountId: player.accountId,
        clanTag: player.clanTag,
        clanColor: player.clanColor,
        isVerified: player.isVerified,
        isSupporter: player.isSupporter,
        twitchLogin: player.twitchLogin,
        tournamentWins: player.tournamentWins,
        tournamentFeaturedWins: player.tournamentFeaturedWins,
        tournamentBestTitle: player.tournamentBestTitle,
        onslaughtBestTier: player.onslaughtBestTier,
        onslaughtBestRank: player.onslaughtBestRank,
        onslaughtSeasons: player.onslaughtSeasons,
      },
    },
  }));
}

/** The best players, with every key of their loadout named and pictured. */
function topPlayerRows(
  stats: TankLoadoutsPayload,
  naming: LoadoutNaming,
): TopPlayerRow[] {
  // Every slot, a free one drawn empty: what was left free is part of the
  // build, and a group never vanishes because nothing was put in it.
  const slotted = (keys: (string | null)[], kind: LoadoutItemKind) =>
    keys.map((key) =>
      key ? icon(key, kind, naming) : { filled: false, name: null, image: null },
    );
  return stats.topPlayers.map((player) => ({
    // Built literally rather than through `identityFromRow`: the payload is
    // camelCase, and that helper reads snake_case on purpose.
    identity: {
      nickname: player.nickname,
      accountId: player.accountId,
      clanTag: player.clanTag,
      clanColor: player.clanColor,
      isVerified: player.isVerified,
      isSupporter: player.isSupporter,
      twitchLogin: player.twitchLogin,
      tournamentWins: player.tournamentWins,
      tournamentFeaturedWins: player.tournamentFeaturedWins,
      tournamentBestTitle: player.tournamentBestTitle,
      onslaughtBestTier: player.onslaughtBestTier,
      onslaughtBestRank: player.onslaughtBestRank,
      onslaughtSeasons: player.onslaughtSeasons,
    },
    region: naming.region,
    battles: player.battles,
    winrate: player.winrate,
    avgDamage: player.avgDamage,
    rating: player.rating,
    equipment: slotted(player.equipment, LoadoutItemKind.Equipment),
    directives: slotted(player.directives, LoadoutItemKind.Directive),
    consumables: slotted(player.consumables, LoadoutItemKind.Consumable),
    fieldMods: slotted(player.fieldMods, LoadoutItemKind.FieldMod),
    // One line per seat: a recording says outright which member carries what,
    // so nothing has to be inferred from a catalogue.
    crew: player.crew.map((member) => {
      const seat = naming.role(member.role);
      return {
        role: seat.label,
        roleImage: seat.image,
        skillLines: [
          { key: member.role, skills: member.skills.map((key) => naming.crewSkill(key)) },
        ],
      };
    }),
    // Every round the gun fires, one the player carries none of drawn faded
    // with its zero, as the garage panel draws it.
    shells: player.shells.map((shell) => {
      const named = naming.shellKind(shell.type);
      return {
        kind: named.kind,
        image: named.image,
        count: shell.count,
        premium: shell.premium,
      };
    }),
  }));
}
