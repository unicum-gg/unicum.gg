"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import type { TopClansResponse } from "@/app/api/[region]/clans/top/route";
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
import type { TopClanResult } from "@/services/wargaming/wot/clans/top";
import { RATING_COLOR_CLASS, wn8Color } from "@/services/wargaming/wot/ratings";
import {
  isRegion,
  Region,
  REGION_EMOJI,
  REGION_LABEL,
} from "@/services/wargaming/wot";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

type State =
  | { status: "loading" }
  | { status: "ok"; results: TopClanResult[]; computedAt: Date | null }
  | { status: "error" };

export function TopClans() {
  const [storedRegion] = useLocalStorage<string>("unicum.region", Region.EU);
  const region: Region = isRegion(storedRegion) ? storedRegion : Region.EU;
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/${region}/clans/top?limit=9`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }
        const body = (await res.json()) as TopClansResponse;
        setState({
          status: "ok",
          results: body.results,
          computedAt: body.computed_at ? new Date(body.computed_at) : null,
        });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, [region]);

  return (
    <div className="flex h-full flex-col">
      <div className={cn("p-4", styles.mutedDescription)}>
        Showing top {REGION_EMOJI[region]} {REGION_LABEL[region]} clans with
        more than 50 members, ranked by average WNX.
        {state.status === "ok" && state.computedAt ? (
          <>
            {" "}
            Updated <RelativeTime date={state.computedAt} />.
          </>
        ) : null}
      </div>
      {state.status === "error" ? (
        <div className="mt-auto border-t border-fd-border p-6 text-center text-sm text-fd-muted-foreground">
          Couldn&apos;t load top clans. Try again later.
        </div>
      ) : state.status === "ok" && state.results.length === 0 ? (
        <div className="mt-auto border-t border-fd-border p-6 text-center text-sm text-fd-muted-foreground">
          No clan data available yet for this region.
        </div>
      ) : (
        <div className="mt-auto">
          <Table className="mb-px! [&_td]:min-w-0 [&_tr]:h-11">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[1%] whitespace-nowrap px-4! text-center!">
                #
              </TableHead>
              <TableHead>Clan</TableHead>
              <TableHead className="pr-4 text-right!">Avg WNX</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.status === "loading"
              ? Array.from({ length: 9 }, (_, i) => `skeleton-${i}`).map(
                  (key) => <SkeletonRow key={key} />,
                )
              : state.results.map((c, i) => (
                  <ClanRow
                    key={c.clan_id}
                    clan={c}
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

function ClanRow({
  clan,
  rank,
  region,
}: {
  clan: TopClanResult;
  rank: number;
  region: Region;
}) {
  const colorClass = RATING_COLOR_CLASS[wn8Color(clan.avg_wnx)];
  return (
    <TableRow>
      <TableCell className="px-4! text-center font-mono tabular-nums text-muted-foreground">
        {rank}
      </TableCell>
      <TableCell>
        <Link
          href={`/${region}/clans/${encodeURIComponent(clan.tag)}`}
          className="flex items-center gap-3 hover:underline"
        >
          {clan.emblem ? (
            <img
              src={clan.emblem}
              alt=""
              width={24}
              height={24}
              className="size-6 shrink-0 rounded"
            />
          ) : (
            <span className="size-6 shrink-0 rounded bg-muted" />
          )}
          <span className="min-w-0 flex-1 truncate">
            <span className="font-mono font-semibold">
              <span style={{ color: clan.color }}>[</span>
              {clan.tag}
              <span style={{ color: clan.color }}>]</span>
            </span>{" "}
            <span className="text-muted-foreground">{clan.name}</span>
          </span>
        </Link>
      </TableCell>
      <TableCell
        className={cn(
          "pr-4 text-right font-semibold tabular-nums",
          colorClass,
        )}
      >
        {intFmt.format(clan.avg_wnx)}
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
        <div className="flex items-center gap-3">
          <span className="size-6 shrink-0 animate-pulse rounded bg-muted" />
          <span className="block h-4 w-40 animate-pulse rounded bg-muted" />
        </div>
      </TableCell>
      <TableCell className="pr-4 text-right">
        <span className="inline-block h-6 w-14 animate-pulse rounded bg-muted" />
      </TableCell>
    </TableRow>
  );
}
