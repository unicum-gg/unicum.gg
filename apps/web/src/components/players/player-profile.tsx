"use client";

import { notFound } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { UnicumError } from "@unicum.gg/sdk";
import { useSession } from "@/lib/auth-client";
import { AccountLockedView } from "@/components/players/account-locked-view";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { LiveSync } from "@/components/live-sync";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { PlayerHeader } from "@/components/players/header";
import { SupporterBadgeState } from "@/components/players/supporter-badge";
import { PlayerMode, PlayerSection } from "@/components/players/tabs";
import { PlayerTabsView } from "@/components/players/tabs-view";
import { PlayerProfileSkeleton } from "@/components/players/player-profile-skeleton";
import { unicum } from "@/services/sdk";
import {
  type PlayerDetailData,
  type PlayerTankRow,
  type RatingMetric,
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
  metric,
  metricLabel,
  nowMs,
  activeSection,
  activeMode,
  initialData,
  initialTanks,
}: {
  region: Region;
  nickname: string;
  basePath: string;
  // Active rating metric (from the cookie). Drives the SWR key + fetch; kept
  // independent of `initialData` so it still resolves when the profile loads
  // client-side (soft nav) with no server-seeded data.
  metric: RatingMetric;
  metricLabel: string;
  nowMs: number;
  activeSection: PlayerSection;
  activeMode: PlayerMode;
  // Server-seeded detail on a direct/crawler hit (SSR, SEO). Null on a client
  // navigation: the profile renders a skeleton and this SWR loads the data.
  initialData: PlayerDetailData | null;
  // Present only when Tanks is the section the server rendered (so its rows are
  // in the initial HTML); null otherwise, so the tabs view fetches on demand.
  initialTanks: PlayerTankRow[] | null;
}) {
  // The SWR key is the request's own URL (`.url()`), so it can't drift from what
  // the SDK actually fetches — no hand-built string to keep in sync.
  const detailReq = () =>
    unicum.region(region).players(nickname).detail({ metric });
  const { data: liveData, error, mutate: mutateData } = useSWR(
    detailReq().url(),
    () => detailReq().then((r) => r as unknown as PlayerDetailData),
    { fallbackData: initialData ?? undefined, revalidateOnMount: initialData == null },
  );
  const detail = liveData ?? initialData ?? null;

  // Whether the signed-in user is viewing their own profile: unlocks the muted
  // supporter badge (a nudge, or a "hidden because anonymous" hint) even when
  // they display none publicly. Keyed off the loaded detail's account id so it
  // still resolves once the client fetch lands on a soft nav.
  const { data: session } = useSession();
  const wg = wgIdentityFromEmail(session?.user?.email);
  const accountId = detail?.player.accountId ?? null;
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

  const supporterBadge: SupporterBadgeState | null = detail?.isSupporter
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

  // Client navigation (soft nav): no server-seeded data, so the outcome is
  // decided by the SWR fetch. The server page handles these states directly on
  // a direct/crawler hit; here we mirror them once the fetch resolves.
  if (!detail) {
    if (error instanceof UnicumError) {
      // Wargaming doesn't know the nickname at all.
      if (error.status === 404) notFound();
      // Resolves on WG but the account is locked (no stats available).
      const body = error.body as { error?: string; nickname?: string } | null;
      if (error.status === 403 && body?.error === "account_locked") {
        return (
          <AccountLockedView
            region={region}
            nickname={body.nickname ?? nickname}
          />
        );
      }
    }
    // Loading (or a transient error SWR will retry): paint the skeleton.
    // LiveSync stays mounted so a tick landing mid-load still refreshes.
    return (
      <>
        <LiveSync subscribe={liveSubscribe} onUpdate={() => void mutateData()} />
        <PlayerProfileSkeleton nickname={nickname} metricLabel={metricLabel} />
      </>
    );
  }

  return (
    <>
      <LiveSync subscribe={liveSubscribe} onUpdate={() => void mutateData()} />
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
        initialTanks={initialTanks}
      />
    </>
  );
}
