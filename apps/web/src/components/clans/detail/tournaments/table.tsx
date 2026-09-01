"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { StarIcon } from "@phosphor-icons/react";
import { LeaderboardFilterBar } from "@/components/players/list/filter-bar";
import { useLeaderboardFilter } from "@/hooks/use-leaderboard-filter";
import { TournamentFacetBar } from "@/components/tournaments/list/facet-bar";
import { useTournamentFacets } from "@/components/tournaments/list/facets";
import { tierBand } from "@/components/tournaments/tier-label";
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
import ROUTES from "@/constants/routes";
import { TournamentStatusBadge } from "@/components/tournaments/status-badge";
import { ordinal, teamFormat } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { ClanTournamentEntry } from "./row";

/** The band as this table shows it: the numeral, or its own placeholder. */
const tierBandOrDash = (from: number | null, to: number | null) =>
  tierBand(from, to) ?? DASH;

const DASH = "—";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * A placement, weighted by what it took. The top three carry the site's rank
 * medal, everything below reads as a plain ordinal.
 *
 * A null placement is not a last place: a double-elimination bracket records no
 * placement at all, and a team that never made it out of registration was never
 * placed either. Both read as a dash rather than as a result.
 */
function Result({ position }: { position: number | null }) {
  if (position === null) return <span className="text-fd-muted-foreground">{DASH}</span>;
  if (position <= 3) {
    return (
      <span className="flex items-center justify-end gap-1.5">
        <RankMedal rank={position as 1 | 2 | 3} className="h-4" />
        {ordinal(position)}
      </span>
    );
  }
  return <span className="tabular-nums">{ordinal(position)}</span>;
}

/**
 * Every tournament the clan has fielded a team in.
 *
 * The team name is the captain's, not the clan's, so it is shown as entered:
 * a clan often plays under something else entirely, and hiding that would make
 * the row impossible to match against the bracket it links to.
 */
export function ClanTournamentsTable({
  region,
  entries,
}: {
  region: Region;
  entries: ClanTournamentEntry[];
}) {
  // The catalogue's own filters, over this clan's entries: a clan that plays
  // weekly has a hundred of them, and the questions asked of that list are the
  // same ones asked of the catalogue ("the 7v7 Onslaughts", "tier X only").
  // `syncUrl` off: the clan page mounts other filtered lists, and two of them
  // writing `?mode=` would fight over it.
  const { facets, filtered } = useTournamentFacets(entries, false);
  const searchFields = useMemo(
    () => (e: ClanTournamentEntry) => [e.title, e.teamTitle],
    [],
  );
  // The catalogue ranges over the size of the field, which a clan's entry does
  // not carry. What it does carry, and what a clan actually asks of its own
  // history, is where the team finished: "the ones we placed top 3 in".
  const rangeCols = useMemo(
    () => [
      {
        key: "result",
        label: "Result",
        value: (e: ClanTournamentEntry) => e.bestPosition,
      },
    ],
    [],
  );
  const { filtered: searched, filters } = useLeaderboardFilter(filtered, {
    searchFields,
    rangeCols,
    initialRangeCol: "result",
  });
  // Memoized: `usePagination` resets its page when the array identity changes,
  // and it does that DURING render, so an inline `.filter()` would loop.
  const { paged, pager } = usePagination(searched, 25, false);

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-fd-border px-4 py-2.5">
        <LeaderboardFilterBar filters={filters} searchNoun="tournaments" />
        <TournamentFacetBar facets={facets} />
      </div>
      {searched.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          No tournament matches the current filters.
        </div>
      ) : (
      <>
      <Table className="my-0! table-fixed [&_td]:min-w-0 [&_td]:py-2! [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!">
        <TableHeader>
          <TableRow>
            {/* Wide enough for the longest date plus a real gap: at `w-28` the
                text ran 4px past its own cell and butted against the next
                column's logo, since a fixed table does not grow to fit. */}
            <TableHead className="w-32 whitespace-nowrap">Date</TableHead>
            <TableHead>Tournament</TableHead>
            <TableHead className="w-40">Played as</TableHead>
            <TableHead className="hidden w-32 md:table-cell">Status</TableHead>
            <TableHead className="hidden w-20 text-end! lg:table-cell">Tier</TableHead>
            <TableHead className="hidden w-24 text-end! lg:table-cell">Format</TableHead>
            <TableHead className="w-24 text-end!">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((e) => (
            <TableRow key={`${e.tournamentId}:${e.teamId}`}>
              <TableCell className="whitespace-nowrap text-fd-muted-foreground tabular-nums">
                {dateFmt.format(e.startAt)}
              </TableCell>
              <TableCell className="truncate">
                {/* The organiser's logo and Wargaming's featured flag, drawn
                    exactly as the catalogue draws them: they are what tells two
                    identically-named dailies apart and what marks a branded
                    championship. */}
                {e.logoUrl?.startsWith("http") && (
                  <Image
                    src={e.logoUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="mr-1.5 inline size-5 align-[-4px] object-contain"
                  />
                )}
                {e.isFeatured && (
                  <StarIcon
                    weight="fill"
                    className="mr-1.5 inline size-3.5 align-[-2px] text-amber-500"
                    aria-label="Featured tournament"
                  />
                )}
                <Link
                  href={ROUTES.TOURNAMENT(region, e.tournamentId)}
                  className="font-medium hover:underline"
                  title={e.title}
                >
                  {e.title}
                </Link>
              </TableCell>
              {/* How much of the roster was really the clan, since a team only
                  needs a quarter of the format to be attributed here. */}
              <TableCell className="truncate text-fd-muted-foreground">
                <Link
                  href={ROUTES.TOURNAMENT_TEAM(region, e.tournamentId, e.teamId)}
                  className="hover:underline"
                  title={
                    e.clanMembers === null
                      ? undefined
                      : `${e.clanMembers} of the roster were in the clan`
                  }
                >
                  {e.teamTitle}
                </Link>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <TournamentStatusBadge status={e.status} settled />
              </TableCell>
              <TableCell className="hidden text-end tabular-nums lg:table-cell">
                {tierBandOrDash(e.tierFrom, e.tierTo)}
              </TableCell>
              <TableCell className="hidden text-end whitespace-nowrap tabular-nums lg:table-cell">
                {teamFormat(e.minPlayersInTeam)}
              </TableCell>
              <TableCell className="text-end">
                <Result position={e.bestPosition} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePager pager={pager} />
      </>
      )}
    </>
  );
}
