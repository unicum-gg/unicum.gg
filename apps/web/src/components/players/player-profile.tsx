"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { LiveSync } from "@/components/live-sync";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { PlayerHeader } from "@/components/players/header";
import { PlayerMode, PlayerSection } from "@/components/players/tabs";
import { PlayerTabsView } from "@/components/players/tabs-view";
import { unicum } from "@/services/sdk";
import { type PlayerDetailData, inferPlayerLanguages } from "@unicum.gg/shared";
import type { LiveUpdate } from "@unicum.gg/sdk";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Client shell owning the player's live data: one SWR entry (seeded from the
 * SSR render) plus one LiveSync subscription. A live tick refetches this JSON
 * and re-renders both the header and the tabs from the same `detail`, so the
 * "Updated X ago" timestamp and refresh beacon stay in sync with the content
 * (they used to be a static server prop while only the tabs went live).
 */
export function PlayerProfile({
  region,
  nickname,
  basePath,
  accountId,
  metricLabel,
  nowMs,
  activeSection,
  activeMode,
  initialData,
}: {
  region: Region;
  nickname: string;
  basePath: string;
  accountId: number;
  metricLabel: string;
  nowMs: number;
  activeSection: PlayerSection;
  activeMode: PlayerMode;
  initialData: PlayerDetailData;
}) {
  const dataUrl = `/api/${region}/players/${encodeURIComponent(nickname)}?metric=${initialData.metric}`;
  const { data: liveData, mutate: mutateData } = useSWR(
    dataUrl,
    () =>
      unicum
        .region(region)
        .players(nickname)
        // `RatingMetric`'s values are exactly these literals; cast to the typed
        // query. The SDK hits our API and revives dates, so the cast just
        // restores the rich domain type the components expect.
        .detail({ metric: initialData.metric as "wn7" | "wn8" | "wnx" })
        .then((r) => r as unknown as PlayerDetailData),
    { fallbackData: initialData, revalidateOnMount: false },
  );
  const detail = liveData ?? initialData;

  // Memoized so LiveSync only re-subscribes when the target player changes.
  const liveSubscribe = useCallback(
    (onUpdate: (event: LiveUpdate) => void) =>
      unicum.region(region).players(nickname).live(onUpdate),
    [region, nickname],
  );

  return (
    <>
      <LiveSync subscribe={liveSubscribe} onUpdate={() => void mutateData()} />
      <Panel>
        <PanelContent className="p-0">
          <PlayerHeader
            region={region}
            accountId={accountId}
            nickname={nickname}
            createdAt={detail.player.createdAt}
            lastBattleAt={detail.player.lastBattleAt}
            updatedAt={detail.player.updatedAt}
            currentStint={detail.clanHistory.currentStint}
            inferredLanguages={inferPlayerLanguages(detail.clanHistory, nowMs)}
          />
        </PanelContent>
      </Panel>
      <PanelSeparator />
      <PlayerTabsView
        region={region}
        basePath={basePath}
        nickname={nickname}
        activeSection={activeSection}
        activeMode={activeMode}
        metricLabel={metricLabel}
        nowMs={nowMs}
        detail={detail}
      />
    </>
  );
}
