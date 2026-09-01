"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import { RankMedal } from "@/components/rank-medal";
import { TablePager, usePagination } from "@/components/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClanTag } from "@/components/entity/clan-tag";
import ROUTES from "@/constants/routes";
import {
  type RangeColumn,
  useLeaderboardFilter,
} from "@/hooks/use-leaderboard-filter";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import {
  RATING_COLOR_CLASS,
  RATING_METRIC_LABEL,
  winrateColor,
} from "@unicum.gg/shared";
import { TournamentTeamStatus, type Region } from "@unicum.gg/wargaming";
import type { TournamentPrizeTier, TournamentTeam } from "./record";
import { placeSpans, type PlaceSpan } from "./placements";
import { prizeBands, rewardFor, rewardLine } from "./rewards";
import {
  ratingColor,
  ratingOf,
  recentRatingOf,
  useRatingMetric,
} from "./team-rating";
import {
  nextSort,
  readSortFromUrl,
  SortHead,
  writeSortToUrl,
} from "@/components/tournaments/sort-head";
import {
  compareTeams,
  isTeamSortColumn,
  TeamSortColumn,
  type TeamRow,
  type TeamSortState,
} from "./teams-sort";

const DASH = "—";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** The range a team's stored place covers, which is what both the shown place
 * and the reward are read from. */
function spanOf(
  stored: number | undefined,
  spans: Map<number, PlaceSpan>,
): PlaceSpan | null {
  if (stored === undefined) return null;
  return spans.get(stored) ?? { from: stored, to: stored };
}

/**
 * A finishing place, in the shape the leaderboards use: a medal alone for the
 * top three, the bare number below it. No ordinal suffix, since every ranked
 * table on the site prints the number.
 *
 * Two teams tied for third both get the bronze, which is what a shared podium
 * is, and what Wargaming pays them ("3rd-4th place" is one reward band).
 */
function PlaceCell({ place }: { place: number | null }) {
  if (place === null) return <>{DASH}</>;
  if (place <= 3) {
    return <RankMedal rank={place as 1 | 2 | 3} className="mx-auto" />;
  }
  return <>{place}</>;
}

/**
 * Who entered, how many they brought, and how strong the line-up is.
 *
 * The roster used to be spelled out here as prose, which made the table a wall
 * of names and buried the one thing a reader scans a field for: whether a team
 * is worth worrying about. The names live on the team's own page, where they are
 * a proper scouting table, and this stays a field list, built like the
 * leaderboards it sits beside.
 */
export function TournamentTeams({
  region,
  tournamentId,
  teams,
  placements,
  maxPlayersInTeam,
  prizeTiers,
  advanced,
  scouting,
}: {
  region: Region;
  tournamentId: number;
  teams: TournamentTeam[];
  /** Where each team finished, for the tournaments that recorded a placement.
   * A stable map rather than a lookup function, so the sort below can depend on
   * it honestly. */
  placements: Map<number, number>;
  /** The roster cap the format allows, so a size reads as what it is out of. */
  maxPlayersInTeam: number;
  /** The organiser's reward table, matched to each finishing place. */
  prizeTiers: TournamentPrizeTier[];
  /** Teams that went through, for a tournament that decided no overall order.
   * Empty when a placement column already answers the question. */
  advanced: Set<number>;
  /** Whether the tournament is still ahead or being played, which is when a
   * reader is sizing up the field rather than reading history. */
  scouting: boolean;
}) {
  const metric = useRatingMetric();
  const [sort, setSort] = useState<TeamSortState>(null);

  // Resolved once over the WHOLE field, not the filtered page: which place a
  // tie starts at is a fact about the tournament, so narrowing the table must
  // not renumber it.
  const spans = useMemo(() => placeSpans(placements), [placements]);
  const bands = useMemo(() => prizeBands(prizeTiers), [prizeTiers]);
  // A tournament that ended on parallel groups decided no overall order, so the
  // column is dropped rather than filled with dashes.
  const ranked = placements.size > 0;

  // Memoized, and that is load-bearing rather than an optimisation:
  // `usePagination` treats a new array identity as a new list and resets its
  // page DURING render, so building this inline made it reset, re-render, and
  // build again until React stopped the loop with "Too many re-renders".
  const rows = useMemo<TeamRow[]>(
    () =>
      teams.map((team) => ({
        team,
        span: spanOf(placements.get(team.id), spans),
        place: spanOf(placements.get(team.id), spans)?.from ?? null,
        advanced: advanced.has(team.id),
        size: team.players.length || team.playersCount,
        rating: ratingOf(team, metric),
        recent: scouting ? recentRatingOf(team, metric) : null,
        winrate: Number.isFinite(team.avgWinrate) ? team.avgWinrate : null,
      })),
    [teams, placements, spans, advanced, metric, scouting],
  );


  // Searching the ROSTER as well as the team name: the question a tournament
  // page gets asked is "which team is this player in", and the account ids
  // behind every roster are the whole reason this is mirrored.
  const searchFields = useCallback(
    (r: TeamRow) => [r.team.title, ...r.team.players.map((p) => p.nickname)],
    [],
  );
  const rangeCols = useMemo<RangeColumn<TeamRow>[]>(
    () => [
      { key: "players", label: "Players", value: (r) => r.size },
      {
        key: "wr",
        label: "WR %",
        value: (r) => (r.winrate === null ? null : r.winrate * 100),
      },
      {
        key: "rating",
        label: RATING_METRIC_LABEL[metric],
        value: (r) => r.rating,
      },
    ],
    [metric],
  );
  const { filtered, filters } = useLeaderboardFilter(rows, {
    searchFields,
    rangeCols,
    initialRangeCol: "rating",
    syncUrl: true,
  });

  // Sorting after filtering, so the two compose: the filter narrows the field,
  // the sort orders what is left.
  const ordered = useMemo(
    () => filtered.slice().sort((a, b) => compareTeams(a, b, sort)),
    [filtered, sort],
  );
  // `syncUrl` off: the pager's own page param is not what this table shares, and
  // the sort/filter params above already carry the view.
  const { paged, pager } = usePagination(ordered, 25, false);

  // Adopt a `?sort=` deep link once on mount. Client-only, since the page is
  // static and `window.location` is not readable while rendering it.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const fromUrl = readSortFromUrl(window.location.search, isTeamSortColumn);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deep link is only readable client-side after mount (the page is static)
    if (fromUrl) setSort(fromUrl);
  }, []);

  function toggleSort(column: TeamSortColumn) {
    setSort((prev) => {
      const next = nextSort(prev, column);
      writeSortToUrl(next);
      return next;
    });
  }

  return (
    <Panel>
      <PanelHeader
        screenLines={false}
        className="flex flex-wrap items-center justify-between gap-2 border-b border-fd-border"
      >
        <PanelTitle>Teams ({teams.length})</PanelTitle>
        <span className="text-xs text-fd-muted-foreground">
          {teams.filter((t) => t.status === TournamentTeamStatus.Confirmed).length}{" "}
          confirmed
        </span>
      </PanelHeader>
      <PanelContent className="p-0">
        {teams.length === 0 ? (
          // A tournament we have listed but not yet mirrored in full, which is
          // the normal state for one that opened since the last sync. Saying so
          // beats a headed table and a pager over nothing.
          <p className={cn(styles.mutedDescription, "p-4")}>
            No teams recorded yet. Registrations appear here once this
            tournament has been read in full, which happens within minutes of it
            opening.
          </p>
        ) : (
          <>
            <div className="border-b border-fd-border px-4 py-2.5">
              <LeaderboardFilterBar filters={filters} searchNoun="teams" />
            </div>
            {filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No team matches the current filters.
              </div>
            ) : (
              <Table
                className={cn(
                  // The leaderboards' compact model, so this reads as a sibling.
                  "my-0! table-fixed",
                  "[&_td]:min-w-0 [&_td]:py-2!",
                  "[&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4!",
                  "[&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!",
                )}
              >
                <TableHeader>
                  <TableRow>
                    {ranked && (
                      <SortHead
                        column={TeamSortColumn.Place}
                        state={sort}
                        onToggle={toggleSort}
                        className="w-20 text-center!"
                      >
                        #
                      </SortHead>
                    )}
                    <SortHead
                      column={TeamSortColumn.Name}
                      state={sort}
                      onToggle={toggleSort}
                    >
                      Team
                    </SortHead>
                    {bands.length > 0 && ranked && (
                      <TableHead className="hidden w-56 lg:table-cell">
                        Reward
                      </TableHead>
                    )}
                    <SortHead
                      column={TeamSortColumn.Players}
                      state={sort}
                      onToggle={toggleSort}
                      className="w-24 text-right!"
                    >
                      Players
                    </SortHead>
                    <SortHead
                      column={TeamSortColumn.Winrate}
                      state={sort}
                      onToggle={toggleSort}
                      className="hidden w-24 text-right! sm:table-cell"
                      label="WR"
                    >
                      WR
                    </SortHead>
                    {/* Form beside career, and only while the tournament is
                        still ahead or in play: the window is the last 30 days
                        from now, so on a settled draw the column would rate the
                        players as they are today under a heading a reader takes
                        for how they turned up on the night. */}
                    {scouting && (
                      <SortHead
                        column={TeamSortColumn.Recent}
                        state={sort}
                        onToggle={toggleSort}
                        className="hidden w-28 text-right! sm:table-cell"
                        label={`${RATING_METRIC_LABEL[metric]} over the last 30 days`}
                      >
                        {RATING_METRIC_LABEL[metric]} · 30d
                      </SortHead>
                    )}
                    <SortHead
                      column={TeamSortColumn.Rating}
                      state={sort}
                      onToggle={toggleSort}
                      className="w-28 text-right!"
                      label={RATING_METRIC_LABEL[metric]}
                    >
                      {RATING_METRIC_LABEL[metric]}
                    </SortHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map(({ team, place, span, size, rating, recent, winrate, advanced: went }) => {
                    const reward = span ? rewardFor(span, bands) : null;
                    return (
                    <TableRow key={team.id}>
                      {ranked && (
                        <TableCell className="text-center text-muted-foreground tabular-nums">
                          <PlaceCell place={place} />
                        </TableCell>
                      )}
                      <TableCell className="truncate font-medium">
                        {/* The tag sits INSIDE the team's link, the way every
                            board pairs a name with its clan: they read as one
                            label, so clicking either half opens the same team.
                            It is not a link to the clan of its own, which would
                            put a second target inside the row. */}
                        <Link
                          href={ROUTES.TOURNAMENT_TEAM(region, tournamentId, team.id)}
                          className="hover:underline"
                        >
                          {team.title}
                          {team.clan && (
                            <>
                              {" "}
                              <ClanTag
                                tag={team.clan.clanTag}
                                color={team.clan.clanColor}
                                className="font-mono text-xs"
                              />
                            </>
                          )}
                        </Link>
                        {/* Only ever shown where there is no placement column:
                            with one, the rank and the medal already say who got
                            through, and a badge beside them would repeat it. */}
                        {went && (
                          <span className="ml-2 inline-block rounded-sm bg-emerald-500/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold tracking-wide whitespace-nowrap text-emerald-600 uppercase dark:text-emerald-400">
                            Qualified
                          </span>
                        )}
                      </TableCell>
                      {bands.length > 0 && ranked && (
                        // Blank rather than a dash when a tie straddles a band:
                        // there is a difference between "won nothing" and "we
                        // cannot say", and a dash would claim the first.
                        <TableCell
                          className="hidden truncate text-fd-muted-foreground lg:table-cell"
                          title={reward?.prizes.join(" \u00b7 ")}
                        >
                          {reward ? rewardLine(reward) : ""}
                        </TableCell>
                      )}
                      {/* Out of the roster cap, muted like every other plain
                          count on a board: "7/8" says a team came a player
                          short, which "7" on its own cannot. */}
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {size || DASH}
                        {size > 0 && maxPlayersInTeam > 0 && (
                          <span className="text-fd-muted-foreground">
                            /{maxPlayersInTeam}
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "hidden text-right font-semibold tabular-nums sm:table-cell",
                          // A fraction, which is the scale `winrateColor`
                          // brackets on: scaled to 100 it paints every row Top.
                          winrate !== null && RATING_COLOR_CLASS[winrateColor(winrate)],
                        )}
                      >
                        {winrate === null ? (
                          <span className="font-normal text-muted-foreground">
                            {DASH}
                          </span>
                        ) : (
                          pctFmt.format(winrate)
                        )}
                      </TableCell>
                      {scouting && (
                        <TableCell
                          className={cn(
                            "hidden text-right font-semibold tabular-nums sm:table-cell",
                            recent !== null && ratingColor(recent, metric),
                          )}
                          title={
                            recent === null
                              ? "None of this roster has played in the last 30 days"
                              : `Average over the ${team.rated30dPlayers} of ${size} players who played in the last 30 days`
                          }
                        >
                          {recent === null ? (
                            <span className="font-normal text-muted-foreground">
                              {DASH}
                            </span>
                          ) : (
                            intFmt.format(recent)
                          )}
                        </TableCell>
                      )}
                      {/* The colour goes on the CELL, like every other rating
                          column on the site: on the value's own span it paints
                          a badge hugging the text instead of filling the
                          column. */}
                      <TableCell
                        className={cn(
                          "text-right font-semibold tabular-nums",
                          rating !== null && ratingColor(rating, metric),
                        )}
                        title={
                          rating === null
                            ? undefined
                            : `Average over ${team.ratedPlayers} of ${size} players`
                        }
                      >
                        {rating === null ? (
                          <span className="font-normal text-muted-foreground">
                            {DASH}
                          </span>
                        ) : (
                          intFmt.format(rating)
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                </TableBody>
              </Table>
            )}
            {pager.total > 0 && <TablePager pager={pager} />}
          </>
        )}
      </PanelContent>
    </Panel>
  );
}
