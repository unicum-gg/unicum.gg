"use client";

import { CrownSimpleIcon } from "@phosphor-icons/react";
import Link from "next/link";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { TournamentStatusBadge } from "@/components/tournaments/status-badge";
import {
  TOURNAMENT_GAME_MODE_LABEL,
  ordinal,
  rosterLimits,
  teamFormat,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { PlayerTournamentEntry } from "./row";

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

/** The tier band as a player reads it: "X", or "VI-X" when the format spans. */
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
        <span className="tabular-nums">{ordinal(position)}</span>
      </span>
    );
  }
  return <span className="tabular-nums">{ordinal(position)}</span>;
}

/** The battle size, with the registrable roster behind it when a team may bring
 * a bench. */
function FormatCell({ min, max }: { min: number; max: number }) {
  const roster = rosterLimits(min, max);
  const label = teamFormat(min);
  if (!roster) return <>{label}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted underline-offset-4">
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>Roster of {roster}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Every tournament this account has entered, newest first.
 *
 * Paged client-side over the whole list, like the other profile tables: a
 * regular carries a few hundred entries and the endpoint returns them in one
 * read, so paging is a slice rather than a round trip.
 */
export function PlayerTournamentsTable({
  region,
  entries,
}: {
  region: Region;
  entries: PlayerTournamentEntry[];
}) {
  // `syncUrl` off: the profile can show a second pager (the tank list) and they
  // would clobber each other's shared `?page=` param.
  const { paged, pager } = usePagination(entries, 25, false);

  return (
    <TooltipProvider delayDuration={150}>
      {/* The same cell rhythm as the sessions and tank tables beside it. */}
      <Table className="my-0! [&_td]:py-1.5! [&_th]:py-2! [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[1%] whitespace-nowrap">Date</TableHead>
            <TableHead>Tournament</TableHead>
            <TableHead className="whitespace-nowrap">Mode</TableHead>
            <TableHead className="text-end">Tier</TableHead>
            <TableHead className="text-end whitespace-nowrap">Format</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-end whitespace-nowrap">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((e) => (
            <TableRow key={`${e.tournamentId}:${e.teamId}`}>
              <TableCell className="whitespace-nowrap text-fd-muted-foreground tabular-nums">
                {dateFmt.format(e.startAt)}
              </TableCell>
              <TableCell>
                {/* The team rather than the tournament: this row is a record
                    of what THIS player did, so the useful destination is their
                    own team's page (its result, its roster), and the tournament
                    itself is one click further on that page's breadcrumb. */}
                <Link
                  href={ROUTES.TOURNAMENT_TEAM(region, e.tournamentId, e.teamId)}
                  className="font-medium hover:underline"
                >
                  {e.title}
                </Link>
                <TournamentStatusBadge status={e.status} className="ml-2" />
              </TableCell>
              <TableCell className="whitespace-nowrap text-fd-muted-foreground">
                {e.gameModes.map((m) => TOURNAMENT_GAME_MODE_LABEL[m]).join(", ") ||
                  DASH}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {tierBandOrDash(e.tierFrom, e.tierTo)}
              </TableCell>
              <TableCell className="text-end whitespace-nowrap tabular-nums">
                <FormatCell min={e.minPlayersInTeam} max={e.maxPlayersInTeam} />
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  <span className="truncate">{e.teamTitle}</span>
                  {e.isCaptain && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CrownSimpleIcon
                          weight="fill"
                          className="size-3.5 shrink-0 text-amber-500"
                          aria-label="Team captain"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        Registered and captained this team
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-end">
                <Result position={e.bestPosition} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePager pager={pager} />
    </TooltipProvider>
  );
}
