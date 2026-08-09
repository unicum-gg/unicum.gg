"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { useSession } from "@/lib/auth-client";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { LiveSync } from "@/components/live-sync";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { PlayerHeader } from "@/components/players/detail/header";
import { SupporterBadgeState } from "@/components/entity/badges/supporter-badge";
import { PlayerMode, PlayerSection } from "@/components/players/detail/tabs";
import { PlayerTabsView } from "@/components/players/detail/tabs-view";
import { useCookie } from "@/hooks/use-cookie";
import STORAGE from "@/constants/storage";
import { unicum } from "@/services/sdk";
import {
  DEFAULT_RATING_METRIC,
  RATING_METRIC_LABEL,
  isRatingMetric,
  type PlayerAchievements,
  type PlayerDetailData,
  type PlayerTankRow,
  inferPlayerLanguages,
} from "@unicum.gg/shared";
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
  activeSection,
  activeMode,
  initialData,
  initialTanks,
  initialAchievements,
}: {
  region: Region;
  nickname: string;
  basePath: string;
  activeSection: PlayerSection;
  activeMode: PlayerMode;
  // Server-rendered detail (the page fetches it inside a Suspense boundary and
  // seeds it here), so this SWR only revalidates on a LiveSync tick.
  initialData: PlayerDetailData;
  // Present only when Tanks is the section the server rendered (so its rows are
  // in the initial HTML); null otherwise, so the tabs view fetches on demand.
  initialTanks: PlayerTankRow[] | null;
  // Present only when Achievements is the section the server rendered, same
  // deal as `initialTanks`.
  initialAchievements: PlayerAchievements | null;
}) {
  // The active metric is client state (the cookie), not a server prop: the page
  // is statically cached and metric-agnostic (the payload carries all three
  // metrics), so switching metric never refetches.
  const [storedMetric] = useCookie(STORAGE.COOKIES.RATING, DEFAULT_RATING_METRIC);
  const metric = isRatingMetric(storedMetric)
    ? storedMetric
    : DEFAULT_RATING_METRIC;
  const metricLabel = RATING_METRIC_LABEL[metric];
  // "Last battle N ago" reference time, taken client-side (the page can't call
  // Date.now() without opting out of static generation).
  const [nowMs] = useState(() => Date.now());

  // The payload is the same for every metric, so a single SWR entry keyed on the
  // request URL; a LiveSync tick revalidates it.
  const detailReq = () => unicum.region(region).players(nickname).detail();
  const { data: liveData, mutate: mutateData } = useSWR(
    detailReq().url(),
    () => detailReq().then((r) => r as unknown as PlayerDetailData),
    { fallbackData: initialData, revalidateOnMount: false },
  );
  const detail = liveData ?? initialData;

  // Whether the signed-in user is viewing their own profile: unlocks the muted
  // supporter badge (a nudge, or a "hidden because anonymous" hint) even when
  // they display none publicly.
  const { data: session } = useSession();
  const wg = wgIdentityFromEmail(session?.user?.email);
  const accountId = detail.player.accountId;
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
      <LiveSync
        subscribe={liveSubscribe}
        onUpdate={() => void mutateData()}
        subject={nickname}
      />
      <Panel>
        <PanelContent className="p-0">
          <PlayerHeader
            region={region}
            accountId={detail.player.accountId}
            nickname={nickname}
            createdAt={detail.player.createdAt}
            lastBattleAt={detail.player.lastBattleAt}
            updatedAt={detail.player.updatedAt}
            currentStint={detail.clanHistory.currentStint}
            inferredLanguages={inferPlayerLanguages(detail.clanHistory, nowMs)}
            supporterBadge={supporterBadge}
            verified={detail.isVerified}
            twitchLogin={detail.twitchLogin}
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
        metric={metric}
        metricLabel={metricLabel}
        nowMs={nowMs}
        detail={detail}
        initialTanks={initialTanks}
        initialAchievements={initialAchievements}
      />
    </>
  );
}
