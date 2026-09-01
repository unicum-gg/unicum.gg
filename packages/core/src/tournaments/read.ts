import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { resolveArenaRefs } from "@unicum.gg/core/wargaming/wot/maps";
import type { MapMarker, MapPoi } from "@unicum.gg/shared";
import {
  resolveAccountClans,
  readTeamClans,
  type TeamClan,
} from "./clans";
import { sanitizeTournamentHtml } from "./sanitize";
import {
  clansByRegion,
  playersByRegion,
  tournamentGroupsByRegion,
  tournamentMatchesByRegion,
  tournamentStagesByRegion,
  tournamentStandingsByRegion,
  tournamentTeamPlayersByRegion,
  tournamentTeamsByRegion,
  tournamentsByRegion,
} from "@unicum.gg/shared";
import type {
  BracketType,
  Region,
  TournamentGameMode,
  TournamentStatus,
  TournamentTeamStatus,
} from "@unicum.gg/wargaming";

/**
 * Reads over the tournament mirror. Everything here is a plain indexed query
 * against our own tables: the tournament system is never called on a page view,
 * so a reader never waits on Wargaming and a settled bracket costs the same
 * whether it is from last night or from 2018.
 *
 * The status/mode/bracket columns are stored as the source's own text codes, so
 * they read back as plain strings and are re-narrowed to their enums here. They
 * are only ever written from those enums, and narrowing at this boundary is what
 * keeps the documented value set intact instead of widening the whole public API
 * to `string`.
 */

export type TournamentListItem = {
  id: number;
  title: string;
  status: TournamentStatus;
  gameModes: TournamentGameMode[];
  tierFrom: number | null;
  tierTo: number | null;
  minPlayersInTeam: number;
  maxPlayersInTeam: number;
  confirmedTeams: number;
  startAt: Date;
  endAt: Date;
  registrationTill: Date | null;
  prize: string | null;
  logoUrl: string | null;
  isFeatured: boolean;
};

export type TournamentList = {
  results: TournamentListItem[];
  totalCount: number;
};

const LIST_COLUMNS = (region: Region) => {
  const t = tournamentsByRegion[region];
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    gameModes: t.gameModes,
    tierFrom: t.tierFrom,
    tierTo: t.tierTo,
    minPlayersInTeam: t.minPlayersInTeam,
    maxPlayersInTeam: t.maxPlayersInTeam,
    confirmedTeams: t.confirmedTeams,
    startAt: t.startAt,
    endAt: t.endAt,
    registrationTill: t.registrationTill,
    prize: t.prize,
    logoUrl: t.logoUrl,
    isFeatured: t.isFeatured,
  };
};

/**
 * The catalogue, newest first.
 *
 * `status` filters to one lifecycle bucket, which is what separates the two
 * things a reader wants: what can still be entered, and what has already been
 * played. Without it the list is the whole archive by date.
 */
export async function listTournaments(
  region: Region,
  {
    status,
    limit = 50,
    offset = 0,
  }: { status?: string; limit?: number; offset?: number } = {},
): Promise<TournamentList> {
  const t = tournamentsByRegion[region];
  const where = status ? eq(t.status, status) : undefined;
  const [rows, [total]] = await Promise.all([
    db
      .select(LIST_COLUMNS(region))
      .from(t)
      .where(where)
      .orderBy(desc(t.startAt))
      .limit(limit)
      .offset(offset),
    db.select({ n: sql<number>`count(*)::int` }).from(t).where(where),
  ]);
  return {
    results: rows.map((r) => ({
      ...r,
      status: r.status as TournamentStatus,
      gameModes: (r.gameModes ?? []) as TournamentGameMode[],
    })),
    totalCount: total?.n ?? 0,
  };
}

export type TournamentTeamEntry = {
  id: number;
  title: string;
  status: TournamentTeamStatus;
  ownerAccountId: number | null;
  playersCount: number;
  players: { accountId: number; nickname: string; role: string }[];
  /**
   * How the roster rates, as a plain mean over the members we have sampled.
   *
   * Plain and not battle-weighted on purpose: the question a captain asks of an
   * opponent's line-up is how strong the players are, and weighting by battles
   * would let one veteran with fifty thousand games speak for the whole team.
   *
   * `ratedPlayers` is the denominator, and it is published rather than folded
   * away: a tournament roster can name accounts our coverage has never reached,
   * and an average over three of eight is a different claim from one over eight.
   */
  ratedPlayers: number;
  avgWn8: number | null;
  avgWnx: number | null;
  /**
   * The same means over the trailing 30 days, and how many of the roster have
   * played in it.
   *
   * A career rating says who these players have been; a tournament is about to
   * be played tonight. The two diverge hard on exactly the accounts a scout
   * cares about, a returning veteran and a player on a run, so the recent
   * window is published beside the lifetime one rather than replacing it.
   * Counted over the players with recent battles only, so a roster where two of
   * seven still play does not report a team average built from two people
   * without saying so.
   */
  rated30dPlayers: number;
  avgWn830d: number | null;
  avgWnx30d: number | null;
  /** The clan this team fielded, when enough of its roster shared one on the
   * day. Null for a mixed team and for one we cannot resolve. */
  clan: TeamClan | null;
  /** Mean win rate as a FRACTION (0.54, not 54), matching the players table and
   * what `winrateColor` brackets on. */
  avgWinrate: number | null;
};

export type TournamentBracketMatch = {
  uuid: string;
  stageId: number;
  groupId: number;
  state: string;
  round: number;
  position: number;
  team1Id: number | null;
  team2Id: number | null;
  winnerTeamId: number | null;
  winsTeam1: number | null;
  winsTeam2: number | null;
  maps: string | null;
  startAt: Date | null;
  nextMatchForWinner: string | null;
};

export type TournamentBracketGroup = {
  id: number;
  order: number;
  state: string;
  teamsCount: number;
  matches: TournamentBracketMatch[];
  standings: {
    teamId: number;
    position: number | null;
    seed: number | null;
    wins: number;
    losses: number;
    draws: number;
    points: number | null;
  }[];
};

export type TournamentBracketStage = {
  id: number;
  title: string;
  bracketType: BracketType;
  winnersPerGroup: number;
  startAt: Date | null;
  groups: TournamentBracketGroup[];
};

export type TournamentDetailRecord = {
  id: number;
  title: string;
  description: string;
  status: TournamentStatus;
  gameModes: TournamentGameMode[];
  tierFrom: number | null;
  tierTo: number | null;
  minPlayersInTeam: number;
  maxPlayersInTeam: number;
  confirmedTeams: number;
  /** The field's cap, when the format sets one. `confirmedTeams` alone says how
   * many entered, never how many it takes. */
  teamsLimit: number | null;
  startAt: Date;
  endAt: Date;
  registrationFrom: Date | null;
  registrationTill: Date | null;
  prize: string | null;
  /**
   * The sessions the tournament is played in: a title and a start.
   *
   * The title is the game SERVER ("EU 2"), which is what Wargaming's own page
   * labels "Server" and the one practical detail a captain needs on the night.
   * We stored it and never served it.
   */
  schedule: { title: string; startAt: string }[];
  prizeTiers: { title: string; order: number; prizes: string[] }[];
  rules: { title: string; description: string; order: number }[];
  /**
   * The maps this tournament is played on, resolved against the map catalogue so
   * the page can link them AND draw where each side starts. The spawns are for
   * this tournament's own battle type, since a map's two sides sit somewhere
   * different in Encounter than in Assault.
   *
   * An arena the catalogue does not know keeps its raw id, with no link and no
   * geometry.
   */
  mapPool: {
    arenaId: string;
    slug: string | null;
    name: string | null;
    minimapUrl: string | null;
    spawns: { team1: MapMarker[]; team2: MapMarker[] };
    bases: { team1: MapMarker[]; team2: MapMarker[] };
    /** The point both sides fight over, on the modes that have one. */
    controlPoint: MapMarker | null;
    /** Onslaught's posts. Empty on every random-battle mode. */
    pointsOfInterest: MapPoi[];
    /** Play area in metres, which a point's capture radius is drawn against. */
    widthMeters: number;
    heightMeters: number;
  }[];
  totalLevelFrom: number | null;
  totalLevelTo: number | null;
  logoUrl: string | null;
  teams: TournamentTeamEntry[];
  stages: TournamentBracketStage[];
};

/**
 * One tournament with everything under it: its rosters and its whole bracket.
 *
 * Assembled in five queries regardless of size (the tournament, its teams, their
 * rosters, its bracket, its tables) and stitched in memory, rather than one
 * query per stage or per group. A tournament is small (the largest here is a few
 * hundred rows) and the shape is a tree, so the fan-out belongs in code, not in
 * round trips.
 */
/**
 * Just the tournament's own row, for the callers that print a few scalars.
 *
 * The OG cards asked `getTournament` for a title, a status and four figures,
 * which assembled every team, every roster, the whole bracket, the map pool and
 * the clan attribution, then threw all of it away. On a fifty-team championship
 * that is the entire draw built per link unfurl.
 */
export async function getTournamentRow(region: Region, tournamentId: number) {
  const t = tournamentsByRegion[region];
  const [row] = await db.select().from(t).where(eq(t.id, tournamentId)).limit(1);
  return row ?? null;
}

export async function getTournament(
  region: Region,
  tournamentId: number,
): Promise<TournamentDetailRecord | null> {
  const t = tournamentsByRegion[region];
  const [row] = await db.select().from(t).where(eq(t.id, tournamentId)).limit(1);
  if (!row) return null;

  const teamsTable = tournamentTeamsByRegion[region];
  const playersTable = tournamentTeamPlayersByRegion[region];
  const stagesTable = tournamentStagesByRegion[region];
  const groupsTable = tournamentGroupsByRegion[region];
  const matchesTable = tournamentMatchesByRegion[region];
  const standingsTable = tournamentStandingsByRegion[region];

  const accounts = playersByRegion[region];

  const arenaIds = row.mapPool ?? [];
  const [
    mapRefs,
    teamRows,
    playerRows,
    ratingRows,
    stageRows,
    groupRows,
    matchRows,
    standingRows,
  ] = await Promise.all([
      // The tournament's own battle type decides which spawns come back. A
      // tournament with several is read on its first, which is the one its
      // pool was built for.
      resolveArenaRefs(region, arenaIds, (row.gameModes ?? [])[0]),
      db
        .select()
        .from(teamsTable)
        .where(eq(teamsTable.tournamentId, tournamentId))
        .orderBy(asc(teamsTable.title)),
      db
        .select()
        .from(playersTable)
        .where(eq(playersTable.tournamentId, tournamentId)),
      // One grouped aggregate for the whole tournament, not the per-team roster
      // join `getTeamRoster` does: this returns one row per team whatever the
      // size of the draw, so a fifty-team championship costs the same read as a
      // four-team cup. Cast to float8 because `avg()` over an integer column
      // comes back as numeric, which the driver would hand us as a string.
      db
        .select({
          teamId: playersTable.teamId,
          ratedPlayers: sql<number>`count(${accounts.wn8})::int`,
          avgWn8: sql<number | null>`avg(${accounts.wn8})::float8`,
          avgWnx: sql<number | null>`avg(${accounts.wnx})::float8`,
          avgWinrate: sql<number | null>`avg(${accounts.winrate})::float8`,
          // The same averages over the trailing 30 days, which is the number
          // that matters for a tournament about to be played: a lifetime rating
          // is a career, and a roster is picked on who is playing well now.
          // Only players with recent battles count, since a 30-day rating on an
          // account that did not play the window is either absent or a stale
          // reading of a player who is not in form, and either way it is not
          // evidence about tonight.
          rated30dPlayers: sql<number>`count(${accounts.wn830d}) filter (where ${accounts.battles30d} > 0)::int`,
          avgWn830d: sql<number | null>`avg(${accounts.wn830d}) filter (where ${accounts.battles30d} > 0)::float8`,
          avgWnx30d: sql<number | null>`avg(${accounts.wnx30d}) filter (where ${accounts.battles30d} > 0)::float8`,
        })
        .from(playersTable)
        .innerJoin(accounts, eq(accounts.accountId, playersTable.accountId))
        .where(eq(playersTable.tournamentId, tournamentId))
        .groupBy(playersTable.teamId),
      db
        .select()
        .from(stagesTable)
        .where(eq(stagesTable.tournamentId, tournamentId))
        .orderBy(asc(stagesTable.startAt)),
      db
        .select()
        .from(groupsTable)
        .where(eq(groupsTable.tournamentId, tournamentId))
        .orderBy(asc(groupsTable.order)),
      db
        .select()
        .from(matchesTable)
        .where(eq(matchesTable.tournamentId, tournamentId))
        .orderBy(asc(matchesTable.round), asc(matchesTable.position)),
      db
        .select()
        .from(standingsTable)
        .where(eq(standingsTable.tournamentId, tournamentId))
        .orderBy(asc(standingsTable.position)),
    ]);

  const rostersByTeam = new Map<number, TournamentTeamEntry["players"]>();
  for (const p of playerRows) {
    const list = rostersByTeam.get(Number(p.teamId)) ?? [];
    list.push({
      accountId: Number(p.accountId),
      nickname: p.nickname,
      role: p.role,
    });
    rostersByTeam.set(Number(p.teamId), list);
  }

  // Read, not recomputed: the attribution was written by the mirror when the
  // tournament settled, and walking the clan history again on every page view
  // is what migration 0094 added the column to avoid.
  const teamClans = await readTeamClans(region, tournamentId);

  const ratingsByTeam = new Map(
    ratingRows.map((r) => [
      Number(r.teamId),
      {
        ratedPlayers: r.ratedPlayers,
        avgWn8: r.avgWn8 === null ? null : Number(r.avgWn8),
        avgWnx: r.avgWnx === null ? null : Number(r.avgWnx),
        avgWinrate: r.avgWinrate === null ? null : Number(r.avgWinrate),
        rated30dPlayers: r.rated30dPlayers,
        avgWn830d: r.avgWn830d === null ? null : Number(r.avgWn830d),
        avgWnx30d: r.avgWnx30d === null ? null : Number(r.avgWnx30d),
      },
    ]),
  );

  const matchesByGroup = new Map<number, TournamentBracketMatch[]>();
  for (const m of matchRows) {
    const list = matchesByGroup.get(Number(m.groupId)) ?? [];
    list.push({
      uuid: m.uuid,
      stageId: Number(m.stageId),
      groupId: Number(m.groupId),
      state: m.state,
      round: m.round,
      position: m.position,
      team1Id: m.team1Id === null ? null : Number(m.team1Id),
      team2Id: m.team2Id === null ? null : Number(m.team2Id),
      winnerTeamId: m.winnerTeamId === null ? null : Number(m.winnerTeamId),
      winsTeam1: m.winsTeam1,
      winsTeam2: m.winsTeam2,
      maps: m.maps,
      startAt: m.startAt,
      nextMatchForWinner: m.nextMatchForWinner,
    });
    matchesByGroup.set(Number(m.groupId), list);
  }

  const standingsByGroup = new Map<number, TournamentBracketGroup["standings"]>();
  for (const s of standingRows) {
    const list = standingsByGroup.get(Number(s.groupId)) ?? [];
    list.push({
      teamId: Number(s.teamId),
      position: s.position,
      seed: s.seed,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      points: s.points,
    });
    standingsByGroup.set(Number(s.groupId), list);
  }

  const groupsByStage = new Map<number, TournamentBracketGroup[]>();
  for (const g of groupRows) {
    const list = groupsByStage.get(Number(g.stageId)) ?? [];
    list.push({
      id: Number(g.id),
      order: g.order,
      state: g.state,
      teamsCount: g.teamsCount,
      matches: matchesByGroup.get(Number(g.id)) ?? [],
      standings: standingsByGroup.get(Number(g.id)) ?? [],
    });
    groupsByStage.set(Number(g.stageId), list);
  }

  return {
    id: Number(row.id),
    title: row.title,
    // Organiser-authored markup, sanitized on the way out so nothing downstream
    // has to decide whether it can be trusted.
    description: sanitizeTournamentHtml(row.description),
    status: row.status as TournamentStatus,
    gameModes: (row.gameModes ?? []) as TournamentGameMode[],
    tierFrom: row.tierFrom,
    tierTo: row.tierTo,
    minPlayersInTeam: row.minPlayersInTeam,
    maxPlayersInTeam: row.maxPlayersInTeam,
    confirmedTeams: row.confirmedTeams,
    teamsLimit: row.teamsLimit,
    schedule: row.schedule ?? [],
    startAt: row.startAt,
    endAt: row.endAt,
    registrationFrom: row.registrationFrom,
    registrationTill: row.registrationTill,
    prize: row.prize,
    prizeTiers: row.prizeTiers ?? [],
    rules: (row.rules ?? []).map((section) => ({
      ...section,
      description: sanitizeTournamentHtml(section.description),
    })),
    mapPool: arenaIds.map((arenaId) => {
      const ref = mapRefs.get(arenaId);
      return {
        arenaId,
        slug: ref?.slug ?? null,
        name: ref?.name ?? null,
        minimapUrl: ref?.minimapUrl ?? null,
        spawns: ref?.spawns ?? { team1: [], team2: [] },
        bases: ref?.bases ?? { team1: [], team2: [] },
        controlPoint: ref?.controlPoint ?? null,
        pointsOfInterest: ref?.pointsOfInterest ?? [],
        widthMeters: ref?.widthMeters ?? 0,
        heightMeters: ref?.heightMeters ?? 0,
      };
    }),
    totalLevelFrom: row.totalLevelFrom,
    totalLevelTo: row.totalLevelTo,
    logoUrl: row.logoUrl,
    teams: teamRows.map((team) => {
      const rating = ratingsByTeam.get(Number(team.id));
      return {
        id: Number(team.id),
        title: team.title,
        status: team.status as TournamentTeamStatus,
        ownerAccountId:
          team.ownerAccountId === null ? null : Number(team.ownerAccountId),
        playersCount: team.playersCount,
        players: rostersByTeam.get(Number(team.id)) ?? [],
        ratedPlayers: rating?.ratedPlayers ?? 0,
        avgWn8: rating?.avgWn8 ?? null,
        avgWnx: rating?.avgWnx ?? null,
        avgWinrate: rating?.avgWinrate ?? null,
        rated30dPlayers: rating?.rated30dPlayers ?? 0,
        avgWn830d: rating?.avgWn830d ?? null,
        avgWnx30d: rating?.avgWnx30d ?? null,
        clan: teamClans.get(Number(team.id)) ?? null,
      };
    }),
    stages: stageRows.map((stage) => ({
      id: Number(stage.id),
      title: stage.title,
      bracketType: stage.bracketType as BracketType,
      winnersPerGroup: stage.winnersPerGroup,
      startAt: stage.startAt,
      groups: groupsByStage.get(Number(stage.id)) ?? [],
    })),
  };
}

/** One tournament a player entered, with how their team finished. */
export type PlayerTournamentEntry = {
  tournamentId: number;
  title: string;
  status: TournamentStatus;
  gameModes: TournamentGameMode[];
  tierFrom: number | null;
  tierTo: number | null;
  /** Roster bounds, which is how a tournament's format reads (7v7, 1v1). */
  minPlayersInTeam: number;
  maxPlayersInTeam: number;
  startAt: Date;
  prize: string | null;
  /** The organiser's logo, and Wargaming's own editorial flag. Both identify a
   * tournament at a glance, which is what a list of a hundred entries needs. */
  logoUrl: string | null;
  isFeatured: boolean;
  teamId: number;
  teamTitle: string;
  teamStatus: TournamentTeamStatus;
  /** Whether this player registered the team. */
  isCaptain: boolean;
  /**
   * Best placement the team reached in this tournament, across its stages, or
   * null when nothing placed it: a team that never got past registration, and
   * every team in a double-elimination bracket, which records no placement at
   * all.
   */
  bestPosition: number | null;
};

export type PlayerTournamentRecord = {
  accountId: number;
  nickname: string;
  entries: PlayerTournamentEntry[];
  /** Entries whose team finished first in one of the tournament's brackets. */
  wins: number;
};

/**
 * A player's tournament record: everything they have entered, newest first,
 * with how far their team got.
 *
 * This is the read the whole mirror exists for. Wargaming publishes tournaments
 * from the tournament's side only, never the player's, so there is nowhere else
 * a player can see what they have played.
 */
export async function getPlayerTournaments(
  region: Region,
  nickname: string,
): Promise<PlayerTournamentRecord | null> {
  const players = playersByRegion[region];
  const [player] = await db
    .select({
      accountId: players.accountId,
      nickname: players.nickname,
      // The crest's own counter, so the tab's summary cannot contradict the
      // mark beside the nickname above it.
      tournamentWins: players.tournamentWins,
    })
    .from(players)
    // Case-insensitive against `lower(nickname)`, which is what the index is on:
    // a plain equality seq-scans the players table (see loadPlayerAchievements).
    .where(sql`LOWER(${players.nickname}) = LOWER(${nickname})`)
    .limit(1);
  if (!player) return null;

  const accountId = Number(player.accountId);
  const rosters = tournamentTeamPlayersByRegion[region];
  const teams = tournamentTeamsByRegion[region];
  const t = tournamentsByRegion[region];

  const rows = await db
    .select({
      tournamentId: t.id,
      title: t.title,
      status: t.status,
      gameModes: t.gameModes,
      tierFrom: t.tierFrom,
      tierTo: t.tierTo,
      minPlayersInTeam: t.minPlayersInTeam,
      maxPlayersInTeam: t.maxPlayersInTeam,
      startAt: t.startAt,
      prize: t.prize,
      // The organiser's own logo and editorial flag, the two things that tell a
      // branded championship from the 51st numbered daily. The catalogue's rows
      // carry both, and a clan's list is read the same way.
      logoUrl: t.logoUrl,
      isFeatured: t.isFeatured,
      teamId: teams.id,
      teamTitle: teams.title,
      teamStatus: teams.status,
      role: rosters.role,
    })
    .from(rosters)
    .innerJoin(teams, eq(teams.id, rosters.teamId))
    .innerJoin(t, eq(t.id, rosters.tournamentId))
    .where(eq(rosters.accountId, accountId))
    .orderBy(desc(t.startAt));

  // Placements in one query for every team at once, rather than per entry: a
  // regular here has hundreds of entries, and one round trip each would make the
  // tab's cost grow with how much the player competes.
  const teamIds = rows.map((r) => Number(r.teamId));
  const standings = tournamentStandingsByRegion[region];
  const placements = teamIds.length
    ? await db
        .select({
          teamId: standings.teamId,
          best: sql<number | null>`min(${standings.position})`,
        })
        .from(standings)
        .where(inArray(standings.teamId, teamIds))
        .groupBy(standings.teamId)
    : [];
  const bestByTeam = new Map(
    placements.map((p) => [Number(p.teamId), p.best === null ? null : Number(p.best)]),
  );

  const entries = rows.map((r) => ({
    tournamentId: Number(r.tournamentId),
    title: r.title,
    status: r.status as TournamentStatus,
    gameModes: (r.gameModes ?? []) as TournamentGameMode[],
    tierFrom: r.tierFrom,
    tierTo: r.tierTo,
    minPlayersInTeam: r.minPlayersInTeam,
    maxPlayersInTeam: r.maxPlayersInTeam,
    startAt: r.startAt,
    prize: r.prize,
    logoUrl: r.logoUrl,
    isFeatured: r.isFeatured,
    teamId: Number(r.teamId),
    teamTitle: r.teamTitle,
    teamStatus: r.teamStatus as TournamentTeamStatus,
    isCaptain: r.role === "owner",
    bestPosition: bestByTeam.get(Number(r.teamId)) ?? null,
  }));

  return {
    accountId,
    nickname: player.nickname,
    entries,
    // The denormalised counter, which is the crest's own number, and NOT a
    // count of `bestPosition === 1`: that is the best place reached in ANY
    // group of any stage, so topping one pool of a four-group qualifier scores
    // as a win. The crest refuses exactly that (see tournaments/winners), and
    // the summary strip sits on the same screen as the crest.
    wins: player.tournamentWins,
  };
}


/**
 * One roster line with the account behind it: who they are now, and how they
 * play.
 *
 * `nickname` is what the roster recorded at the time; `currentNickname` is what
 * the account is called today. They differ for anyone who renamed since, and
 * showing both is the honest way to keep an old bracket readable while still
 * linking somewhere that resolves.
 *
 * The stats are null for an account we have never sampled. That is a real state
 * (a tournament roster can name an account the coverage has not reached), not a
 * zero, and the table renders it as absent rather than as a player with no
 * battles.
 */
export type TournamentRosterEntry = {
  accountId: number;
  nickname: string;
  role: string;
  currentNickname: string | null;
  clanTag: string | null;
  clanColor: string | null;
  /** The clan they were in ON THE DAY, which is what the recorded nickname
   * belongs beside. Null when they were in none, or when we cannot resolve it. */
  recordedClanTag: string | null;
  recordedClanColor: string | null;
  battles: number | null;
  winrate: number | null;
  wn8: number | null;
  wnx: number | null;
};

export type TournamentTeamRoster = {
  id: number;
  tournamentId: number;
  title: string;
  status: TournamentTeamStatus;
  ownerAccountId: number | null;
  players: TournamentRosterEntry[];
};

/**
 * One team's roster, joined onto the accounts behind it.
 *
 * Its own read rather than a field on the tournament detail: a championship
 * carries fifty teams of fifteen, and joining stats for all of them would make
 * every bracket page pay for a table only one of them ever shows.
 *
 * Read from `players` and not from the materialized `player_ratings`: that one
 * is the leaderboard's own slice and holds only accounts that qualify for it
 * (eight of one eighteen-player roster, measured), so it would leave most of a
 * team blank.
 */
export async function getTeamRoster(
  region: Region,
  tournamentId: number,
  teamId: number,
): Promise<TournamentTeamRoster | null> {
  const teams = tournamentTeamsByRegion[region];
  const rosters = tournamentTeamPlayersByRegion[region];
  const players = playersByRegion[region];
  const clans = clansByRegion[region];

  const tournaments = tournamentsByRegion[region];
  const [[team], [tournament]] = await Promise.all([
    db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.tournamentId, tournamentId)))
      .limit(1),
    db
      .select({ startAt: tournaments.startAt })
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1),
  ]);
  if (!team || !tournament) return null;

  const rows = await db
    .select({
      accountId: rosters.accountId,
      nickname: rosters.nickname,
      role: rosters.role,
      currentNickname: players.nickname,
      battles: players.battles,
      winrate: players.winrate,
      wn8: players.wn8,
      wnx: players.wnx,
      clanTag: clans.tag,
      clanColor: clans.color,
    })
    .from(rosters)
    .leftJoin(players, eq(players.accountId, rosters.accountId))
    .leftJoin(clans, eq(clans.id, players.clanId))
    .where(eq(rosters.teamId, teamId));

  // The clan each of them was in on the day, so the recorded nickname is shown
  // beside the tag it was carried under rather than beside today's.
  const thenClans = await resolveAccountClans(
    region,
    rows.map((r) => Number(r.accountId)),
    tournament.startAt,
  );

  return {
    id: Number(team.id),
    tournamentId: Number(team.tournamentId),
    title: team.title,
    status: team.status as TournamentTeamStatus,
    ownerAccountId:
      team.ownerAccountId === null ? null : Number(team.ownerAccountId),
    players: rows.map((r) => ({
      accountId: Number(r.accountId),
      nickname: r.nickname,
      role: r.role,
      currentNickname: r.currentNickname,
      clanTag: r.clanTag,
      clanColor: r.clanColor,
      recordedClanTag: thenClans.get(Number(r.accountId))?.tag ?? null,
      recordedClanColor: thenClans.get(Number(r.accountId))?.color ?? null,
      battles: r.battles,
      winrate: r.winrate,
      wn8: r.wn8,
      wnx: r.wnx,
    })),
  };
}

/** One tournament a clan entered, with how its team finished. */
export type ClanTournamentEntry = {
  tournamentId: number;
  title: string;
  status: TournamentStatus;
  gameModes: TournamentGameMode[];
  tierFrom: number | null;
  tierTo: number | null;
  minPlayersInTeam: number;
  maxPlayersInTeam: number;
  startAt: Date;
  prize: string | null;
  /** The organiser's logo, and Wargaming's own editorial flag. Both identify a
   * tournament at a glance, which is what a list of a hundred entries needs. */
  logoUrl: string | null;
  isFeatured: boolean;
  teamId: number;
  teamTitle: string;
  teamStatus: TournamentTeamStatus;
  /** How many of the roster were in the clan on the day, so a reader can judge
   * how much of this was really the clan. */
  clanMembers: number | null;
  /** Best placement the team reached, or null when nothing placed it. */
  bestPosition: number | null;
};

export type ClanTournamentRecord = {
  clanId: number;
  tag: string;
  entries: ClanTournamentEntry[];
  /** Entries whose team finished first in one of the tournament's brackets. */
  wins: number;
};

/**
 * Every tournament a clan has entered, newest first.
 *
 * The join that makes this possible does not exist upstream: Wargaming's
 * tournament system knows teams and account ids, never clans. A team is tied to
 * a clan here by matching its roster against clan membership on the day it was
 * played (see `tournaments/clans`), stored on the team row, which is what turns
 * "which tournaments did we play" into an indexed read instead of a walk over
 * every roster in the archive.
 */
export async function getClanTournaments(
  region: Region,
  tag: string,
): Promise<ClanTournamentRecord | null> {
  const clans = clansByRegion[region];
  const [clan] = await db
    .select({
      id: clans.id,
      tag: clans.tag,
      tournamentWins: clans.tournamentWins,
    })
    .from(clans)
    .where(sql`UPPER(${clans.tag}) = UPPER(${tag})`)
    .limit(1);
  if (!clan) return null;

  const clanId = Number(clan.id);
  const teams = tournamentTeamsByRegion[region];
  const t = tournamentsByRegion[region];

  const rows = await db
    .select({
      tournamentId: t.id,
      title: t.title,
      status: t.status,
      gameModes: t.gameModes,
      tierFrom: t.tierFrom,
      tierTo: t.tierTo,
      minPlayersInTeam: t.minPlayersInTeam,
      maxPlayersInTeam: t.maxPlayersInTeam,
      startAt: t.startAt,
      prize: t.prize,
      // The organiser's own logo and editorial flag, the two things that tell a
      // branded championship from the 51st numbered daily. The catalogue's rows
      // carry both, and a clan's list is read the same way.
      logoUrl: t.logoUrl,
      isFeatured: t.isFeatured,
      teamId: teams.id,
      teamTitle: teams.title,
      teamStatus: teams.status,
      clanMembers: teams.clanMembers,
    })
    .from(teams)
    .innerJoin(t, eq(t.id, teams.tournamentId))
    .where(eq(teams.clanId, clanId))
    .orderBy(desc(t.startAt));

  // Placements for every team at once, like the player record: a clan that
  // competes weekly has hundreds of entries, and one round trip each would make
  // the tab cost grow with how much the clan plays.
  const teamIds = rows.map((r) => Number(r.teamId));
  const standings = tournamentStandingsByRegion[region];
  const placements = teamIds.length
    ? await db
        .select({
          teamId: standings.teamId,
          best: sql<number | null>`min(${standings.position})`,
        })
        .from(standings)
        .where(inArray(standings.teamId, teamIds))
        .groupBy(standings.teamId)
    : [];
  const bestByTeam = new Map(
    placements.map((p) => [Number(p.teamId), p.best === null ? null : Number(p.best)]),
  );

  const entries = rows.map((r) => ({
    tournamentId: Number(r.tournamentId),
    title: r.title,
    status: r.status as TournamentStatus,
    gameModes: (r.gameModes ?? []) as TournamentGameMode[],
    tierFrom: r.tierFrom,
    tierTo: r.tierTo,
    minPlayersInTeam: r.minPlayersInTeam,
    maxPlayersInTeam: r.maxPlayersInTeam,
    startAt: r.startAt,
    prize: r.prize,
    logoUrl: r.logoUrl,
    isFeatured: r.isFeatured,
    teamId: Number(r.teamId),
    teamTitle: r.teamTitle,
    teamStatus: r.teamStatus as TournamentTeamStatus,
    clanMembers: r.clanMembers,
    bestPosition: bestByTeam.get(Number(r.teamId)) ?? null,
  }));

  return {
    clanId,
    tag: clan.tag,
    entries,
    // Same as the player twin above: the counter the crest is written from,
    // not a count of best-in-any-group.
    wins: clan.tournamentWins,
  };
}
