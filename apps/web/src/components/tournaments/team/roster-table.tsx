"use client";

import { CrownSimpleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { ClanTag } from "@/components/entity/clan-tag";
import { GlossaryLabel } from "@/components/glossary/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { cn } from "@/lib/utils";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RATING_COLOR_CLASS,
  RATING_METRIC_LABEL,
  RatingMetric,
  winrateColor,
  wn8Color,
  wnxColor,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const DASH = "—";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type RosterEntry = {
  accountId: number;
  nickname: string;
  role: string;
  currentNickname: string | null;
  clanTag: string | null;
  clanColor: string | null;
  /** The clan they were in on the day, shown beside the recorded nickname. */
  recordedClanTag: string | null;
  recordedClanColor: string | null;
  battles: number | null;
  winrate: number | null;
  wn8: number | null;
  wnx: number | null;
};

/** WN7 has no column of its own here, so a reader on it sees WN8: the roster is
 * a scouting table, and a blank column would read as "no data" rather than as
 * "not one of the two we cache per account". */
function ratingOf(entry: RosterEntry, metric: RatingMetric): number | null {
  return metric === RatingMetric.Wnx ? entry.wnx : entry.wn8;
}

function ratingColor(value: number, metric: RatingMetric): string {
  return RATING_COLOR_CLASS[
    metric === RatingMetric.Wnx ? wnxColor(value) : wn8Color(value)
  ];
}

/**
 * The roster as a scouting table, the same shape the leaderboards use.
 *
 * A tournament roster is a list of account ids, and the whole reason we mirror
 * it is that we already know those accounts. Rendering it as prose ("A, B, C")
 * threw that away; ordered by rating with battles and win rate beside each name,
 * it answers the question a captain actually opens an opponent's team for.
 */
export function TeamRosterTable({
  region,
  players,
  ownerAccountId,
}: {
  region: Region;
  players: RosterEntry[];
  ownerAccountId: number | null;
}) {
  const [stored] = useCookie(STORAGE.COOKIES.RATING, DEFAULT_RATING_METRIC);
  const metric = isRatingMetric(stored) ? stored : DEFAULT_RATING_METRIC;
  // Best first, and everyone we have no rating for last: an unsampled account
  // sorted as a zero would read as the worst player on the team.
  const ordered = players
    .slice()
    .sort(
      (a, b) =>
        (ratingOf(b, metric) ?? -1) - (ratingOf(a, metric) ?? -1) ||
        a.nickname.localeCompare(b.nickname),
    );

  return (
    <Table
      className={cn(
        "my-0! table-fixed",
        "[&_td]:min-w-0 [&_td]:py-2!",
        "[&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4!",
        "[&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!",
      )}
    >
      <TableHeader>
        <TableRow>
          <TableHead>Player</TableHead>
          <TableHead className="w-28 text-right! tabular-nums">
            <GlossaryLabel>Battles</GlossaryLabel>
          </TableHead>
          <TableHead className="hidden w-24 text-right! tabular-nums sm:table-cell">
            <GlossaryLabel>WR</GlossaryLabel>
          </TableHead>
          <TableHead className="w-24 text-right!">
            <GlossaryLabel label={RATING_METRIC_LABEL[metric]}>
              {RATING_METRIC_LABEL[metric]}
            </GlossaryLabel>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ordered.map((p) => {
          const rating = ratingOf(p, metric);
          // Link on the current name when we know it: the recorded one may no
          // longer resolve, and a profile link that 404s is worse than one that
          // lands on the renamed account.
          const linkName = p.currentNickname ?? p.nickname;
          const renamed =
            p.currentNickname !== null && p.currentNickname !== p.nickname;
          // Also when only the clan moved: "(as [OLDTAG])" is the interesting
          // half for a player who kept their name but changed side.
          const recorded = renamed || p.recordedClanTag !== p.clanTag;
          return (
            <TableRow key={p.accountId}>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  <Link
                    href={ROUTES.PLAYER(region, linkName)}
                    className="flex min-w-0 items-center gap-2 hover:underline"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{linkName}</span>
                      {p.clanTag && (
                        <>
                          {" "}
                          <ClanTag
                            tag={p.clanTag}
                            color={p.clanColor}
                            className="font-mono text-xs"
                          />
                        </>
                      )}
                    </span>
                  </Link>
                  {p.accountId === ownerAccountId && (
                    <CrownSimpleIcon
                      weight="fill"
                      className="size-3.5 shrink-0 text-amber-500"
                      aria-label="Team captain"
                    />
                  )}
                  {/* What they were called AND what they wore, the way the
                      Onslaught board shows a recorded identity. Wargaming
                      freezes the nickname at the time of the tournament, so the
                      clan beside it is resolved for that day too: pairing an
                      old name with today's tag would invent a line-up that
                      never played. Shown when either half has changed. */}
                  {recorded && (
                    <span
                      className="shrink-0 truncate text-xs text-fd-muted-foreground"
                      title={`Registered as ${p.nickname}`}
                    >
                      (as {p.nickname}
                      {p.recordedClanTag && (
                        <>
                          {" "}
                          <ClanTag
                            tag={p.recordedClanTag}
                            color={p.recordedClanColor}
                            className="font-mono"
                          />
                        </>
                      )}
                      )
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {p.battles === null ? (
                  <span className="text-fd-muted-foreground">{DASH}</span>
                ) : (
                  intFmt.format(p.battles)
                )}
              </TableCell>
              {/* Colour on the cell, not on a span around the number: the
                  leaderboards fill the whole column, and on the span it reads
                  as a badge stuck to the text. */}
              <TableCell
                className={cn(
                  "hidden text-right font-semibold tabular-nums sm:table-cell",
                  // A fraction, not a percentage: `winrateColor` brackets on
                  // 0.45..0.65, so scaling to 100 first painted every row Top.
                  p.winrate !== null && RATING_COLOR_CLASS[winrateColor(p.winrate)],
                )}
              >
                {p.winrate === null ? (
                  <span className="font-normal text-fd-muted-foreground">{DASH}</span>
                ) : (
                  pctFmt.format(p.winrate)
                )}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-semibold tabular-nums",
                  rating !== null && ratingColor(rating, metric),
                )}
              >
                {rating === null ? (
                  <span className="font-normal text-fd-muted-foreground">{DASH}</span>
                ) : (
                  intFmt.format(rating)
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
