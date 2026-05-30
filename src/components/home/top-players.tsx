"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import type { TopPlayersResponse } from "@/app/api/[region]/players/top/route";
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
import type {
  TopPlayerResult,
  TopPlayersPeriod,
} from "@/services/wargaming/wot/players/top";
import { RATING_COLOR_CLASS, wn8Color } from "@/services/wargaming/wot/ratings";
import { isRegion, Region } from "@/services/wargaming/wot";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

type State =
  | { status: "loading" }
  | { status: "ok"; results: TopPlayerResult[] }
  | { status: "error" };

export function TopPlayers({
  period,
  description,
}: {
  period: TopPlayersPeriod;
  description: string;
}) {
  const [storedRegion] = useLocalStorage<string>("unicum.region", Region.EU);
  const region: Region = isRegion(storedRegion) ? storedRegion : Region.EU;
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/${region}/players/top?period=${period}&limit=10`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }
        const body = (await res.json()) as TopPlayersResponse;
        setState({ status: "ok", results: body.results });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, [region, period]);

  return (
    <div className="flex h-full flex-col">
      <div className={cn("p-4", styles.mutedDescription)}>{description}</div>
      {state.status === "error" ? (
        <div className="mt-auto border-t border-fd-border p-6 text-center text-sm text-fd-muted-foreground">
          Couldn&apos;t load. Try again later.
        </div>
      ) : state.status === "ok" && state.results.length === 0 ? (
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
              {state.status === "loading"
                ? Array.from({ length: 9 }, (_, i) => `s-${i}`).map((k) => (
                    <SkeletonRow key={k} />
                  ))
                : state.results
                    .slice(0, 9)
                    .map((p, i) => (
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

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell className="px-4! text-center">
        <span className="inline-block h-4 w-4 animate-pulse rounded bg-muted" />
      </TableCell>
      <TableCell>
        <span className="block h-4 w-32 animate-pulse rounded bg-muted" />
      </TableCell>
      <TableCell className="pr-4 text-right">
        <span className="inline-block h-6 w-14 animate-pulse rounded bg-muted" />
      </TableCell>
    </TableRow>
  );
}
