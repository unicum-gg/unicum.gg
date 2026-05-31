"use client";

import Link from "next/link";
import { useLocalStorage } from "usehooks-ts";
import { RelativeTime } from "@/components/relative-time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { TopPlayerResult } from "@/services/wargaming/wot/players/top";
import { RATING_COLOR_CLASS, wn8Color } from "@/services/wargaming/wot/ratings";
import { isRegion, Region } from "@/services/wargaming/wot";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export type TopPlayersInitial = Record<
  Region,
  { results: TopPlayerResult[]; computedAt: Date | null }
>;

export function TopPlayers({
  description,
  initial,
}: {
  description: string;
  initial: TopPlayersInitial;
}) {
  const [storedRegion] = useLocalStorage<string>("unicum.region", Region.EU);
  const region: Region = isRegion(storedRegion) ? storedRegion : Region.EU;
  const { results, computedAt } = initial[region];

  return (
    <div className="flex h-full flex-col">
      <div className={cn("p-4", styles.mutedDescription)}>
        {description}
        {computedAt ? (
          <>
            {" "}
            Updated <RelativeTime date={computedAt} />.
          </>
        ) : null}
      </div>
      {results.length === 0 ? (
        <div className="mt-auto border-t border-fd-border p-6 text-center text-sm text-fd-muted-foreground">
          No data available yet.
        </div>
      ) : (
        <div className="mt-auto">
          <Table className="mb-px! [&_td]:min-w-0 [&_tr]:h-11">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[1%] whitespace-nowrap px-4! text-center!">
                  #
                </TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="pr-4 text-right!">WNX</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.slice(0, 9).map((p, i) => (
                <PlayerRow
                  key={p.account_id}
                  player={p}
                  rank={i + 1}
                  region={region}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  rank,
  region,
}: {
  player: TopPlayerResult;
  rank: number;
  region: Region;
}) {
  const colorClass = RATING_COLOR_CLASS[wn8Color(player.wnx)];
  return (
    <TableRow>
      <TableCell className="px-4! text-center font-mono tabular-nums text-muted-foreground">
        {rank}
      </TableCell>
      <TableCell>
        <Link
          href={`/${region}/players/${encodeURIComponent(player.nickname)}`}
          className="block truncate hover:underline"
        >
          <span className="font-medium">{player.nickname}</span>
          {player.clan_tag ? (
            <>
              {" "}
              <span className="font-mono text-xs">
                <span style={{ color: player.clan_color ?? undefined }}>[</span>
                {player.clan_tag}
                <span style={{ color: player.clan_color ?? undefined }}>]</span>
              </span>
            </>
          ) : null}
        </Link>
      </TableCell>
      <TableCell
        className={cn("pr-4 text-right font-semibold tabular-nums", colorClass)}
      >
        {intFmt.format(player.wnx)}
      </TableCell>
    </TableRow>
  );
}
