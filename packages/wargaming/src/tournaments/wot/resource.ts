import { Region, REGION_WOT_HOST } from "../../region";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import {
  parseTournamentDetail,
  parseTournamentSummary,
  type RawTournament,
  type TournamentDetail,
  type TournamentStatus,
  type TournamentSummary,
} from "./catalog";
import { parseTeam, type RawTeam, type TournamentTeam } from "./teams";
import {
  parseGroup,
  parseMatch,
  parseStage,
  parseStanding,
  type RawGroup,
  type RawMatch,
  type RawStage,
  type RawStanding,
  type TournamentGroup,
  type TournamentMatch,
  type TournamentStage,
  type TournamentStanding,
} from "./brackets";

// The tournament system answers under `/tmsis/` on the WoT portal host itself,
// so it needs no application_id and carries no `status: ok` WG API envelope of
// the kind `wgFetch` unwraps. Its own envelope is `{ status, data }` with the
// payload under `data.results`.
const API_PREFIX = "/tmsis/api/v1";

// Every endpoint rejects a request without a language ("filter_language:
// required"), including the ones with nothing to translate, so it is set on all
// of them rather than only where it shows.
const DEFAULT_LANGUAGE = "en";

// The catalogue's own ceiling. `page[size]` is honoured up to 100 and the plain
// `page`/`per_page` names the URL suggests are silently ignored (a request for
// page 53 with `page` returns page 1 again, which reads as "no more results"
// rather than as an error).
const MAX_PAGE_SIZE = 100;

type Envelope<T> = {
  status: string;
  data: { results: T; total_count?: number; page?: number };
};

/** A page of the tournament catalogue, plus the size of the full result set. */
export type TournamentPage = {
  tournaments: TournamentSummary[];
  totalCount: number;
  page: number;
};

/** A page of a tournament's registered teams. */
export type TournamentTeamPage = {
  teams: TournamentTeam[];
  totalCount: number;
};

/**
 * Wargaming's tournament system (`worldoftanks.<tld>/tmsis/api/v1`), which runs
 * everything from the nightly gold ladders to the seasonal clan championships.
 *
 * Undocumented and unversioned in practice, but public and unauthenticated for
 * every read below, and the only place team rosters, brackets and results are
 * published at all: none of it reaches the public WG API. Rosters carry account
 * ids, so a tournament record joins straight onto player data.
 */
export class TournamentsResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  #url(path: string, filters: Record<string, string | number> = {}): URL {
    const url = new URL(`https://${REGION_WOT_HOST[this.region]}${API_PREFIX}${path}`);
    url.searchParams.set("filter[language]", DEFAULT_LANGUAGE);
    for (const [key, value] of Object.entries(filters)) {
      url.searchParams.set(`filter[${key}]`, String(value));
    }
    return url;
  }

  #get<T>(url: URL): Promise<Envelope<T>> {
    return this.t.getJson<Envelope<T>>(url, {
      region: this.region,
      limit: RateLimit.Tournaments,
    });
  }

  /**
   * Read a list endpoint to the end.
   *
   * Every one of them pages, and the default page is TEN, which is the trap
   * here: a 30-team bracket answers a bare standings request with its top ten
   * and a `total_count` of 30, so a caller that reads `results` and stops has
   * silently kept a third of the table and been told so only in a field it did
   * not look at. Asking for the maximum page and then following `total_count` is
   * what makes a short answer mean "that is all of it".
   *
   * `total_count` is absent on a couple of endpoints (stages), which is why a
   * short page also ends the walk: without it there is nothing left to ask for.
   */
  async #getAll<T>(url: URL): Promise<T[]> {
    const out: T[] = [];
    for (let page = 1; ; page++) {
      url.searchParams.set("page[number]", String(page));
      url.searchParams.set("page[size]", String(MAX_PAGE_SIZE));
      const res = await this.#get<T[]>(url);
      const rows = res.data.results ?? [];
      out.push(...rows);
      const total = res.data.total_count;
      if (rows.length < MAX_PAGE_SIZE) return out;
      if (total !== undefined && out.length >= total) return out;
    }
  }

  /**
   * One page of the catalogue, newest first. Filter by `status` to walk a single
   * lifecycle bucket: `Complete` is the settled archive (it goes back to 2018)
   * and is the only one large enough to need paging.
   *
   * `title` is a substring match on the tournament name.
   */
  async list({
    status,
    title,
    minPlayers,
    tagId,
    page = 1,
    pageSize = MAX_PAGE_SIZE,
  }: {
    status?: TournamentStatus;
    title?: string;
    minPlayers?: number;
    tagId?: number;
    page?: number;
    pageSize?: number;
  } = {}): Promise<TournamentPage> {
    const filters: Record<string, string | number> = {};
    if (status) filters.status = status;
    if (title) filters.title = title;
    if (minPlayers !== undefined) filters.min_players = minPlayers;
    if (tagId !== undefined) filters.tag_id = tagId;
    const url = this.#url("/lobby/", filters);
    url.searchParams.set("page[number]", String(page));
    url.searchParams.set("page[size]", String(Math.min(pageSize, MAX_PAGE_SIZE)));
    const res = await this.#get<RawTournament[]>(url);
    return {
      tournaments: (res.data.results ?? []).map(parseTournamentSummary),
      totalCount: res.data.total_count ?? 0,
      page: res.data.page ?? page,
    };
  }

  /**
   * Every tournament matching the filter, walking the catalogue page by page.
   * Yields a page at a time so a caller can persist as it goes rather than hold
   * the whole archive (thousands of rows per region) in memory.
   */
  async *listAll(
    filters: {
      status?: TournamentStatus;
      title?: string;
      minPlayers?: number;
      tagId?: number;
    } = {},
  ): AsyncGenerator<TournamentSummary[]> {
    let page = 1;
    let seen = 0;
    for (;;) {
      const res = await this.list({ ...filters, page, pageSize: MAX_PAGE_SIZE });
      if (res.tournaments.length === 0) return;
      yield res.tournaments;
      seen += res.tournaments.length;
      if (seen >= res.totalCount) return;
      page += 1;
    }
  }

  /** One tournament in full: map pool, prize breakdown, rules, schedule. */
  async get({ tournamentId }: { tournamentId: number }): Promise<TournamentDetail> {
    const res = await this.#get<RawTournament>(this.#url(`/tournament/${tournamentId}/`));
    return parseTournamentDetail(res.data.results);
  }

  /** Just the lifecycle status, for cheaply re-checking whether a tournament
   * has settled without pulling its whole record. */
  async status({ tournamentId }: { tournamentId: number }): Promise<TournamentStatus> {
    const url = this.#url(`/tournament/${tournamentId}/status/`);
    const res = await this.t.getJson<{ data: { status: TournamentStatus } }>(url, {
      region: this.region,
      limit: RateLimit.Tournaments,
    });
    return res.data.status;
  }

  /** One page of registered teams, each with its full roster. */
  async teams({
    tournamentId,
    page = 1,
    pageSize = MAX_PAGE_SIZE,
  }: {
    tournamentId: number;
    page?: number;
    pageSize?: number;
  }): Promise<TournamentTeamPage> {
    const url = this.#url("/tournament/teams/", { tournament_id: tournamentId });
    url.searchParams.set("page[number]", String(page));
    url.searchParams.set("page[size]", String(Math.min(pageSize, MAX_PAGE_SIZE)));
    const res = await this.#get<RawTeam[]>(url);
    return {
      teams: (res.data.results ?? []).map(parseTeam),
      totalCount: res.data.total_count ?? 0,
    };
  }

  /** Every registered team with its roster, paging until the list runs out. */
  async allTeams({ tournamentId }: { tournamentId: number }): Promise<TournamentTeam[]> {
    const out: TournamentTeam[] = [];
    for (let page = 1; ; page++) {
      const res = await this.teams({ tournamentId, page });
      out.push(...res.teams);
      if (res.teams.length === 0 || out.length >= res.totalCount) return out;
    }
  }

  /** The tournament's phases, in the order they are played. */
  async stages({ tournamentId }: { tournamentId: number }): Promise<TournamentStage[]> {
    const url = this.#url("/stages/", { tournament_id: tournamentId });
    const rows = await this.#getAll<RawStage>(url);
    return rows.map(parseStage);
  }

  /** The brackets inside one stage: a single tree for a knockout, one per pool
   * for a group stage. */
  async groups({
    tournamentId,
    stageId,
  }: {
    tournamentId: number;
    stageId: number;
  }): Promise<TournamentGroup[]> {
    const url = this.#url("/stages/groups/", {
      tournament_id: tournamentId,
      stage_id: stageId,
    });
    const rows = await this.#getAll<RawGroup>(url);
    return rows.map((g) => parseGroup(g, stageId));
  }

  /** Every tie in one bracket, played or still pending. */
  async matches({
    tournamentId,
    stageId,
    groupId,
  }: {
    tournamentId: number;
    stageId: number;
    groupId: number;
  }): Promise<TournamentMatch[]> {
    const url = this.#url("/stages/groups/matches/", {
      tournament_id: tournamentId,
      stage_id: stageId,
      group_id: groupId,
    });
    const rows = await this.#getAll<RawMatch>(url);
    return rows.map(parseMatch);
  }

  /**
   * One bracket's final table, which is where a placement comes from: a
   * knockout's tree says who beat whom but never who came third.
   *
   * What fills the row depends on the bracket. A round robin returns a real
   * table (`wins`/`losses`/`points` all counted). A knockout returns placement
   * only: `position` is the finishing order and every counter stays at zero, so
   * reading a 0-0 record there as "played nothing" would be wrong. Positions
   * are also not dense, teams knocked out in the same round share a rank, so a
   * 30-team bracket runs 1, 2, 4, 4 and so on.
   */
  async groupStandings({
    tournamentId,
    stageId,
    groupId,
  }: {
    tournamentId: number;
    stageId: number;
    groupId: number;
  }): Promise<TournamentStanding[]> {
    const url = this.#url("/stages/groups/standings/", {
      tournament_id: tournamentId,
      stage_id: stageId,
      group_id: groupId,
    });
    const rows = await this.#getAll<RawStanding>(url);
    return rows.map(parseStanding);
  }

  /**
   * The tournament's own standings: every team's placement WITHIN ITS GROUP,
   * carrying the captain's account id. Not an overall ranking, so several rows
   * share position 1 when the last stage had several pools, and the win/loss
   * counters are often left at zero. Empty on many tournaments.
   */
  async standings({ tournamentId }: { tournamentId: number }): Promise<TournamentStanding[]> {
    const url = this.#url(`/tournament/${tournamentId}/standings/`);
    const rows = await this.#getAll<RawStanding>(url);
    return rows.map(parseStanding);
  }
}
