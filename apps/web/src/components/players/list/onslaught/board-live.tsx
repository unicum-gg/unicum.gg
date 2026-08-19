"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  OnslaughtBoard,
  type OnslaughtRow,
} from "@/components/players/list/onslaught/board";
import { OnslaughtRankScale } from "@/components/players/list/onslaught/rank-scale";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { unicum } from "@/services/sdk";
import type { Region } from "@unicum.gg/wargaming";

// The full standings are pulled once and paginated client-side (matches the
// server default). The API caps at its own max.
const LIMIT = 60000;

// The SDK's Onslaught payload (dates already revived), reused as the shape the
// page hands in and the client refetch returns.
type OnslaughtData = Awaited<
  ReturnType<ReturnType<typeof unicum.region>["players"]["onslaught"]>
>;

// Client owner of the season-dependent board. The page renders the CURRENT
// season statically (ISR, like the other leaderboards), so it stays a cheap
// cached read; a past season is picked with `?season=`, which the server ignores
// on a static page, so this reads it client-side and refetches that season's
// standings through the SDK. Keeps the common case (current season) fast while
// the whole season history stays reachable.
export function OnslaughtBoardLive({
  region,
  initial,
}: {
  region: Region;
  initial: OnslaughtData;
}) {
  const params = useSearchParams();
  const seasonParam = params.get("season");
  const currentId = initial.season?.eventId ?? null;

  // A past season is requested when `?season=` names something other than the
  // one the page already rendered; no param (or the current season) just shows
  // the server data.
  const isPast = Boolean(seasonParam && seasonParam !== currentId);

  // The last settled past-season fetch (success carries its data, failure a
  // null). Only the fetched season lives in state; the current season is the
  // server `initial`, derived below rather than copied in via setState (which
  // would be a synchronous cascading render on every navigation). Every setState
  // here fires from an async callback, never synchronously in the effect body.
  const [settled, setSettled] = useState<{
    id: string;
    data: OnslaughtData | null;
  } | null>(null);

  useEffect(() => {
    if (!isPast || !seasonParam) return;
    let cancelled = false;
    unicum
      .region(region)
      .players.onslaught({ limit: LIMIT, season: seasonParam })
      .then((res) => {
        if (!cancelled) setSettled({ id: seasonParam, data: res });
      })
      .catch(() => {
        if (!cancelled) setSettled({ id: seasonParam, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [isPast, seasonParam, region]);

  // Show the fetched standings once they match the requested season; otherwise
  // (current season, or a past one still loading, or a failed fetch) the server
  // data. Pending is derived: a requested past season with no matching settle yet.
  const resolved = isPast && settled?.id === seasonParam ? settled : null;
  const data = resolved?.data ?? initial;
  const showPending = isPast && settled?.id !== seasonParam;
  const season = data.season;

  return (
    <div
      className={
        showPending ? "opacity-60 transition-opacity" : "transition-opacity"
      }
    >
      <OnslaughtBoard
        region={region}
        results={data.results as OnslaughtRow[]}
        elitePosition={season?.elitePosition ?? null}
        masterPosition={season?.masterPosition ?? null}
        seasonOrdinal={season?.seasonOrdinal ?? null}
        assetsRef={season?.assetsRef ?? null}
        seasons={data.seasons}
        currentSeasonId={season?.eventId ?? null}
      />

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Ranks</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <OnslaughtRankScale
            seasonOrdinal={season?.seasonOrdinal ?? null}
            assetsRef={season?.assetsRef ?? null}
          />
        </PanelContent>
      </Panel>
    </div>
  );
}
