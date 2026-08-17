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

  const [data, setData] = useState<OnslaughtData>(initial);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // No param, or it points at the season the page already rendered → nothing
    // to fetch; snap back to the server data (also covers navigating home).
    if (!seasonParam || seasonParam === currentId) {
      setData(initial);
      setPending(false);
      return;
    }
    let cancelled = false;
    setPending(true);
    unicum
      .region(region)
      .players.onslaught({ limit: LIMIT, season: seasonParam })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(initial);
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [seasonParam, currentId, region, initial]);

  const season = data.season;

  return (
    <div
      className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}
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
