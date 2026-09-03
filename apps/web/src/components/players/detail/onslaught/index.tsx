"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import useSWR from "swr";
import {
  ONSLAUGHT_TIER_LABEL,
  onslaughtRankIcon,
  onslaughtTier,
  OnslaughtTier,
  RATING_COLOR_CLASS,
  ONSLAUGHT_TIER_COLOR,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import ROUTES from "@/constants/routes";
import { useDisplayZone } from "@/components/servers/use-display-zone";
import { unicum } from "@/services/sdk";

// recharts arrives only once there is a climb worth drawing, which is a few
// thousand players per region rather than every profile that opens this tab.
const PlayerOnslaughtChart = dynamic(
  () => import("./chart").then((m) => m.PlayerOnslaughtChart),
  { ssr: false, loading: () => <div className="h-56 w-full" /> },
);

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
});

export type PlayerOnslaughtData = Awaited<
  ReturnType<ReturnType<ReturnType<typeof unicum.region>["players"]>["onslaught"]>
>;
type Standing = PlayerOnslaughtData["standings"][number];

/** The leaderboard this standing is a place ON, at the right season. The live
 * season is the board's default, so it needs no query of its own. */
function boardHref(region: Region, standing: Standing, isLatest: boolean) {
  const base = ROUTES.PLAYERS_ONSLAUGHT(region);
  return isLatest
    ? base
    : `${base}?season=${encodeURIComponent(standing.eventId)}`;
}


/**
 * The player's Onslaught record: where they stand this season, how they climbed
 * to it, and every season they have ranked in before.
 *
 * A battle mode beside Steel Hunter, but one that renders nothing like the
 * others: the rest of that row draw the per-account statistics Wargaming
 * publishes per mode, and Onslaught has none (the per-player dossier is
 * readable only from inside a game session). What exists is a standing on a
 * public board, so that is what this draws, and every standing links back to
 * the board it is a place on.
 *
 * Only players who reach Champion ever appear on that board, so the empty state
 * is the common one and says so plainly instead of looking like a page that
 * failed to load.
 */
export function OnslaughtTab({
  region,
  data,
  loading,
  nickname,
}: {
  region: Region;
  data: PlayerOnslaughtData | null;
  loading: boolean;
  nickname: string;
}) {
  const zone = useDisplayZone();
  const standings = data?.standings ?? [];
  const latest = standings[0] ?? null;
  const climb = data?.history ?? [];

  // The season's own cutoff curve, so the climb can be drawn against the bar it
  // is climbing towards. Keyed on the season and only asked for once there is a
  // climb to draw; a null key is how SWR is told to stay idle.
  const { data: season } = useSWR(
    latest && climb.length >= 2
      ? [`onslaught-season-history`, region, latest.eventId]
      : null,
    () => unicum.region(region).players.onslaughtHistory(latest!.eventId),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  if (loading && standings.length === 0) {
    return (
      <>
        <PanelSeparator />
        <Panel>
          <PanelContent className="px-4 py-10 text-center text-sm text-fd-muted-foreground">
            Loading {nickname}&apos;s Onslaught record...
          </PanelContent>
        </Panel>
      </>
    );
  }

  if (standings.length === 0 || latest == null) {
    return (
      <>
        <PanelSeparator />
        <Panel>
          <PanelHeader>
            <PanelTitle>Onslaught</PanelTitle>
          </PanelHeader>
          <PanelContent className="px-4 py-8 text-sm text-fd-muted-foreground">
            <p>
              {nickname} has not held a place on the Onslaught leaderboard.
            </p>
            <p className="mt-2">
              The board only lists players who reach Champion, a few thousand per
              region, so this is where almost every profile lands. It fills in by
              itself the season they get there.
            </p>
          </PanelContent>
        </Panel>
      </>
    );
  }

  const past = standings.slice(1);

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{nickname}&apos;s Onslaught record</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <Current standing={latest} region={region} />
          {climb.length >= 2 ? (
            <PlayerOnslaughtChart
              climb={climb}
              cutoffs={season?.points ?? []}
              zone={zone}
            />
          ) : null}
          {past.length > 0 ? (
            <ul className="divide-y divide-fd-border border-t border-fd-border">
              {past.map((s) => (
                <PastSeason key={s.eventId} standing={s} region={region} />
              ))}
            </ul>
          ) : null}
        </PanelContent>
      </Panel>
    </>
  );
}

/** The most recent season, given the room a placing deserves. */
function Current({
  standing,
  region,
}: {
  standing: Standing;
  region: Region;
}) {
  const tier = onslaughtTier(standing.rank, standing);
  const href = boardHref(region, standing, true);
  return (
    <div className="flex flex-wrap items-center gap-4 p-4">
      {tier ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={onslaughtRankIcon(tier, standing.seasonOrdinal, standing.assetsRef)}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0"
        />
      ) : null}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {tier ? <TierBadge tier={tier} /> : null}
          <Link
            href={href}
            className="text-2xl font-semibold tabular-nums hover:underline"
            title="See this season's leaderboard"
          >
            #{intFmt.format(standing.rank)}
          </Link>
        </div>
        <div className="text-sm text-fd-muted-foreground">
          <Link href={href} className="hover:underline">
            {standing.codename ?? "Onslaught"}
          </Link>
          {" · "}
          {intFmt.format(standing.rating)} rating points
          {" · "}
          {intFmt.format(standing.battles)} battles
          {standing.ended ? " · final" : " · live season"}
        </div>
      </div>
    </div>
  );
}

/** A finished season, one line: where they placed and what it took. */
function PastSeason({
  standing,
  region,
}: {
  standing: Standing;
  region: Region;
}) {
  const tier = onslaughtTier(standing.rank, standing);
  const href = boardHref(region, standing, false);
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
      {tier ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={onslaughtRankIcon(tier, standing.seasonOrdinal, standing.assetsRef)}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 shrink-0"
        />
      ) : null}
      <Link href={href} className="font-medium hover:underline">
        {standing.codename ?? standing.eventId}
      </Link>
      <Link
        href={href}
        className="tabular-nums text-fd-muted-foreground hover:underline"
      >
        #{intFmt.format(standing.rank)}
      </Link>
      {tier ? <TierBadge tier={tier} /> : null}
      <span className="ml-auto text-fd-muted-foreground">
        {standing.endDate ? dateFmt.format(new Date(standing.endDate)) : null}
      </span>
    </li>
  );
}

/** The rank's name in the rank's own colour, as the board draws it. */
function TierBadge({ tier }: { tier: OnslaughtTier }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-semibold ${RATING_COLOR_CLASS[ONSLAUGHT_TIER_COLOR[tier]]}`}
    >
      {ONSLAUGHT_TIER_LABEL[tier]}
    </span>
  );
}
