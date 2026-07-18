"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { useSession } from "@/lib/auth-client";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { LiveSync } from "@/components/live-sync";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { PlayerHeader } from "@/components/players/header";
import { SupporterBadgeState } from "@/components/players/supporter-badge";
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

  // Whether the signed-in user is viewing their own profile: unlocks the muted
  // supporter badge (a nudge, or a "hidden because anonymous" hint) even when
  // they display none publicly.
  const { data: session } = useSession();
  const wg = wgIdentityFromEmail(session?.user?.email);
  const isOwnProfile =
    !!wg && wg.region === region && wg.accountId === accountId;

  // The owner's private support status (public `detail.isSupporter` is false for
  // anonymous supporters, so it cannot tell "anonymous" from "not a supporter").
  const [me, setMe] = useState<{
    isSupporter: boolean;
    anonymous: boolean;
  } | null>(null);
  useEffect(() => {
    if (!isOwnProfile) return;
    let alive = true;
    fetch("/api/support/me")
      .then((r) => r.json())
      .then(
        (d: { isSupporter: boolean; anonymous: boolean }) => alive && setMe(d),
      )
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isOwnProfile]);

  const supporterBadge: SupporterBadgeState | null = detail.isSupporter
    ? SupporterBadgeState.Active
    : isOwnProfile
      ? me?.isSupporter && me.anonymous
        ? SupporterBadgeState.HiddenAnonymous
        : SupporterBadgeState.Invite
      : null;

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
            supporterBadge={supporterBadge}
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
