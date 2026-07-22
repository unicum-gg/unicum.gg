import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  modeFromQuery,
  sectionFromQuery,
  PlayerMode,
  PlayerSection,
} from "@/components/players/tabs";
import { PlayerProfile } from "@/components/players/player-profile";
import { PlayerProfileSkeleton } from "@/components/players/player-profile-skeleton";
import { AccountLockedView } from "@/components/players/account-locked-view";
import { JsonLd } from "@/components/json-ld";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getRatingMetricFromCookies } from "@/lib/rating-metric";
import { breadcrumbSchema, personSchema } from "@/lib/schema-org";
import { styles } from "@/lib/styles";
import { unicum } from "@/services/sdk";
import { UnicumError } from "@unicum.gg/sdk";
import {
  RATING_METRIC_LABEL,
  type PlayerDetailData,
  type PlayerTankRow,
  type RatingMetric,
} from "@unicum.gg/shared";
import { type Region, isRegion } from "@unicum.gg/wargaming";

const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// The page consumes its own public API through the SDK: the same
// `GET /{region}/players/{nickname}` payload the client refetches on LiveSync.
// The endpoint owns the stale-while-revalidate flow (cached data immediately;
// a cold cache resolves the account on WG, fetches live and records a
// snapshot). Next memoizes identical fetches within one render pass, so
// generateMetadata and the page body share a single request.
type LockedAccount = { locked: true; nickname: string };

async function loadDetail(
  region: Region,
  nickname: string,
  metric: RatingMetric,
): Promise<PlayerDetailData | LockedAccount | null> {
  try {
    const detail = await unicum
      .region(region)
      .players(nickname)
      .detail({ metric });
    return detail as unknown as PlayerDetailData;
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    // The endpoint answers 403 "account_locked" when WG resolves the nickname
    // but has locked the account (its data is gone from the API).
    if (error instanceof UnicumError && error.status === 403) {
      const body = error.body as { error?: string; nickname?: string } | null;
      if (body?.error === "account_locked") {
        return { locked: true, nickname: body.nickname ?? nickname };
      }
    }
    throw error;
  }
}

// Dynamic on purpose: the page consumes our own API through the SDK, and
// prerendering it at build time would make the build depend on a running API.
// The endpoints cache server-side, so per-request cost is local HTTP hops onto
// cached payloads.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; nickname: string }>;
}): Promise<Metadata> {
  const { region, nickname } = await params;
  if (!isRegion(region)) return {};
  const decoded = decodeURIComponent(nickname);
  const regionLabel = region.toUpperCase();
  const metric = await getRatingMetricFromCookies();
  const result = await loadDetail(region, decoded, metric).catch(() => null);

  if (result && "locked" in result) {
    return constructMetadata({
      title: `${result.nickname} World of Tanks account locked (${regionLabel})`,
      description: `${result.nickname} (${regionLabel}) exists but Wargaming has locked this account, so its World of Tanks stats are not available.`,
      ogImage: false,
    });
  }

  const detail = result;
  const displayName = detail?.player.nickname ?? decoded;

  if (!detail || detail.current.battles === 0) {
    return constructMetadata({
      title: `${displayName} World of Tanks player stats (${regionLabel})`,
      description: `${displayName} (${regionLabel}) World of Tanks player stats: WN8, WNX ratings, winrate, tank-by-tank breakdown and full clan history.`,
      ogImage: false,
    });
  }

  const { current } = detail;
  const winrate = pctFmt.format((current.wins / current.battles) * 100);
  const battles = intFmt.format(current.battles);
  const rating = current.wtr ?? current.globalRating;
  return constructMetadata({
    title: `${displayName} World of Tanks stats (${regionLabel}), ${battles} battles, ${winrate}% WR`,
    description: `${displayName} on ${regionLabel}: ${battles} battles, ${winrate}% winrate, ${intFmt.format(rating)} rating. Tank-by-tank breakdown, WN8, WNX and full clans history.`,
    ogImage: false,
  });
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string; nickname: string }>;
  searchParams: Promise<{ tab?: string; section?: string }>;
}) {
  const [{ region, nickname }, { tab: tabParam, section: sectionParam }] =
    await Promise.all([params, searchParams]);
  if (!isRegion(region)) notFound();
  const decoded = decodeURIComponent(nickname);
  // Two independent nav axes, each its own query param (see components/players/tabs).
  const section = sectionFromQuery(sectionParam);
  const mode = modeFromQuery(tabParam);
  const metric = await getRatingMetricFromCookies();
  const metricLabel = RATING_METRIC_LABEL[metric];

  // Nothing before this boundary blocks (params + a cookie read), so Next flushes
  // the shell and the full-fidelity skeleton immediately, then streams the real,
  // server-rendered profile in when `loadDetail` resolves. Navigation shows the
  // skeleton at ~ttfb while every load stays fully server-rendered (crawlers get
  // the streamed content). Scoped to this page, so the `vs/` compare child keeps
  // its own loading UI — unlike a `loading.tsx`, which would leak here.
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
          <PlayerProfileSkeleton nickname={decoded} metricLabel={metricLabel} />
          <div aria-hidden className={`flex-1 ${styles.borderX}`} />
        </div>
      }
    >
      <PlayerProfileServer
        region={region}
        decoded={decoded}
        section={section}
        mode={mode}
        metric={metric}
        metricLabel={metricLabel}
      />
    </Suspense>
  );
}

/** The data-dependent half of the page, isolated behind the Suspense boundary so
 * its `loadDetail` await streams in rather than blocking the initial paint. */
async function PlayerProfileServer({
  region,
  decoded,
  section,
  mode,
  metric,
  metricLabel,
}: {
  region: Region;
  decoded: string;
  section: PlayerSection;
  mode: PlayerMode;
  metric: RatingMetric;
  metricLabel: string;
}) {
  const detail = await loadDetail(region, decoded, metric);
  if (detail && "locked" in detail) {
    return <AccountLockedView nickname={detail.nickname} region={region} />;
  }
  if (!detail) notFound();

  // The per-tank list is ~92% of the former detail payload but only the Tanks
  // section renders it, so it lives on its own endpoint and is fetched on
  // demand. Server-render it only for a `?section=tanks` deep-link (SEO /
  // crawlers); every other section leaves `initialTanks` null so the client
  // loads it lazily when the section is first opened.
  const initialTanks: PlayerTankRow[] | null =
    section === PlayerSection.Tanks
      ? ((await unicum.region(region).players(decoded).tanks())
          .tanks as unknown as PlayerTankRow[])
      : null;
  const { current, clanHistory } = detail;
  const displayName = detail.player.nickname;
  // eslint-disable-next-line react-hooks/purity -- server component, evaluated once per request; a fresh "now" drives the "last battle N ago" relative times
  const nowMs = Date.now();

  const regionLabel = region.toUpperCase();
  const winrate =
    current.battles > 0 ? (current.wins / current.battles) * 100 : 0;
  const playerDescription =
    current.battles > 0
      ? `${displayName} (${regionLabel}) World of Tanks player stats: ${intFmt.format(current.battles)} battles, ${pctFmt.format(winrate)}% winrate, WN8 and WNX ratings, tank-by-tank breakdown and clan history.`
      : `${displayName} (${regionLabel}) World of Tanks player stats: WN8, WNX ratings, winrate, tank-by-tank breakdown and full clan history.`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
      <JsonLd
        data={personSchema({
          nickname: displayName,
          region: regionLabel,
          url: `${APP.URL}${ROUTES.PLAYER(region, displayName)}`,
          description: playerDescription,
          clanName: clanHistory.currentStint?.clan.name ?? null,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: `${APP.URL}${ROUTES.HOME(region)}` },
          { name: "Players", url: `${APP.URL}${ROUTES.PLAYERS(region)}` },
          {
            name: displayName,
            url: `${APP.URL}${ROUTES.PLAYER(region, displayName)}`,
          },
        ])}
      />
      <PlayerProfile
        region={region}
        nickname={displayName}
        basePath={ROUTES.PLAYER(region, displayName)}
        metric={metric}
        metricLabel={metricLabel}
        nowMs={nowMs}
        activeSection={section}
        activeMode={mode}
        initialData={detail}
        initialTanks={initialTanks}
      />
      {/* Fills the leftover height on short tabs (e.g. Value) so the side
          borders run down to the footer instead of stopping at the last panel,
          mirroring the footer's own bordered spacer. Collapses to 0 when the
          content already fills the viewport. */}
      <div aria-hidden className={`flex-1 ${styles.borderX}`} />
    </div>
  );
}
