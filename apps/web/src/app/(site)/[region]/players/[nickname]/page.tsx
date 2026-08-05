import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  DEFAULT_PLAYER_VIEW,
  PlayerMode,
  PlayerSection,
  type PlayerView,
  playerViewHref,
} from "@/components/players/detail/tabs";
import { PlayerProfile } from "@/components/players/detail/view";
import { AccountLockedView } from "@/components/players/detail/account-locked";
import { JsonLd } from "@/components/json-ld";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { breadcrumbSchema, personSchema } from "@/lib/schema-org";
import { styles } from "@/lib/styles";
import { unicum } from "@/services/sdk";
import { UnicumError } from "@unicum.gg/sdk";
import {
  type PlayerDetailData,
  type PlayerTankRow,
} from "@unicum.gg/shared";
import { type Region, isRegion } from "@unicum.gg/wargaming";

const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// The page consumes its own public API through the SDK: one metric-agnostic
// payload (liftDrag + ratingHistory carry all three metrics), the same
// `GET /{region}/players/{nickname}` the client refetches on LiveSync. The
// endpoint owns the stale-while-revalidate flow (cached data immediately; a cold
// cache resolves the account on WG, fetches live and records a snapshot). Next
// memoizes identical fetches within one render pass, so generateMetadata and the
// page body share a single request.
type LockedAccount = { locked: true; nickname: string };

async function loadDetail(
  region: Region,
  nickname: string,
): Promise<PlayerDetailData | LockedAccount | null> {
  try {
    const detail = await unicum.region(region).players(nickname).detail();
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

// ISR, not dynamic (mirrors the clan/tank pages): the whole rendered profile is
// cached, so a navigation serves prerendered HTML instead of re-running the
// heavy player-view render each time (measured 1.5-3s/nav while force-dynamic,
// vs ~18ms edge-cached — the render was the machine's #1 CPU cost). Everything
// that used to force dynamic rendering is now client-side: the metric is read
// from the cookie (the payload is metric-agnostic), the section/mode nav lives
// in the URL (tabs-view reads it), and the "last battle N ago" reference time is
// taken client-side. So this page reads no cookies/searchParams/Date.now() and
// stays static. Live data still hot-swaps via the player SSE (LiveSync), and
// per-page-hit refreshes are enqueued by the endpoint. On-demand generation (no
// generateStaticParams); the SDK loopback covers any build-time prerender.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

/** Wording for the view being rendered, so each mode is a page of its own
 * rather than nine copies of the same title. */
function viewCopy(
  view: PlayerView,
  name: string,
  regionLabel: string,
  battles: string,
  winrate: string,
  rating: string,
): { title: string; description: string } {
  if (view.section === PlayerSection.Tanks) {
    return {
      title: `${name} tanks (${regionLabel}), every vehicle played`,
      description: `Every tank ${name} has played on ${regionLabel}, with battles, win rate, average damage and WN8 per vehicle.`,
    };
  }
  if (view.section === PlayerSection.Value) {
    return {
      title: `${name} account value (${regionLabel})`,
      description: `What ${name}'s World of Tanks account on ${regionLabel} is worth: credits, gold and experience tied up in the garage.`,
    };
  }
  if (view.mode !== PlayerMode.Overall) {
    return {
      title: `${name} ${view.label} stats (${regionLabel})`,
      description: `${name} on ${regionLabel} in ${view.label}: battles, win rate and ratings for this mode, next to their random-battles baseline.`,
    };
  }
  return {
    title: `${name} World of Tanks stats (${regionLabel}), ${battles} battles, ${winrate}% WR`,
    description: `${name} on ${regionLabel}: ${battles} battles, ${winrate}% winrate, ${rating} rating. Tank-by-tank breakdown, WN8, WNX and full clans history.`,
  };
}

export async function playerMetadata(
  region: string,
  nickname: string,
  view: PlayerView,
): Promise<Metadata> {
  if (!isRegion(region)) return {};
  const decoded = decodeURIComponent(nickname);
  const regionLabel = region.toUpperCase();
  const result = await loadDetail(region, decoded).catch(() => null);

  if (result && "locked" in result) {
    return constructMetadata({
      title: `${result.nickname} World of Tanks account locked (${regionLabel})`,
      description: `${result.nickname} (${regionLabel}) exists but Wargaming has locked this account, so its World of Tanks stats are not available.`,
      ogImage: `/api/og/${region}/players/${encodeURIComponent(decoded)}`,
      canonical: playerViewHref(ROUTES.PLAYER(region, decoded), view),
    });
  }

  const detail = result;
  const displayName = detail?.player.nickname ?? decoded;

  if (!detail || detail.current.battles === 0) {
    return constructMetadata({
      title: `${displayName} World of Tanks player stats (${regionLabel})`,
      description: `${displayName} (${regionLabel}) World of Tanks player stats: WN8, WNX ratings, winrate, tank-by-tank breakdown and full clan history.`,
      ogImage: `/api/og/${region}/players/${encodeURIComponent(decoded)}`,
      canonical: playerViewHref(ROUTES.PLAYER(region, decoded), view),
    });
  }

  const { current } = detail;
  const copy = viewCopy(
    view,
    displayName,
    regionLabel,
    intFmt.format(current.battles),
    pctFmt.format((current.wins / current.battles) * 100),
    intFmt.format(current.wtr ?? current.globalRating),
  );
  return constructMetadata({
    title: copy.title,
    description: copy.description,
    ogImage: `/api/og/${region}/players/${encodeURIComponent(decoded)}`,
    canonical: playerViewHref(ROUTES.PLAYER(region, decoded), view),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; nickname: string }>;
}): Promise<Metadata> {
  const { region, nickname } = await params;
  return playerMetadata(region, nickname, DEFAULT_PLAYER_VIEW);
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ region: string; nickname: string }>;
}) {
  const { region, nickname } = await params;
  if (!isRegion(region)) notFound();
  return renderPlayerPage(region, decodeURIComponent(nickname), DEFAULT_PLAYER_VIEW);
}

// Render the profile inline (blocking on `loadDetail`) rather than streaming it
// behind a Suspense skeleton: force-static prerenders the whole page, so the
// real stats land in the cached HTML. That keeps the `.md` twin and non-JS
// crawlers complete (a Suspense boundary would leave only the skeleton in
// `#page-content`, with the stats streamed into a hidden node only JS swaps in).
// `view` comes from the route segment, so only that view renders and its
// metadata match what is on screen.
export function renderPlayerPage(
  region: Region,
  decoded: string,
  view: PlayerView,
) {
  return (
    <PlayerProfileServer
      region={region}
      decoded={decoded}
      section={view.section}
      mode={view.mode}
    />
  );
}

/** The data-dependent half of the page. Its `loadDetail` await blocks the render
 * so the static prerender captures the full profile (see the note above). */
async function PlayerProfileServer({
  region,
  decoded,
  section,
  mode,
}: {
  region: Region;
  decoded: string;
  section: PlayerSection;
  mode: PlayerMode;
}) {
  const detail = await loadDetail(region, decoded);
  if (detail && "locked" in detail) {
    return <AccountLockedView nickname={detail.nickname} region={region} />;
  }
  if (!detail) notFound();

  // The per-tank list is ~92% of the former detail payload but only the Tanks
  // section renders it, so it lives on its own endpoint and is fetched on
  // demand. Server-render it only for a `?section=tanks` deep-link (SEO /
  // crawlers); with the static section default it is normally null, so the
  // client loads it lazily when the section is first opened.
  const initialTanks: PlayerTankRow[] | null =
    section === PlayerSection.Tanks
      ? ((await unicum.region(region).players(decoded).tanks())
          .tanks as unknown as PlayerTankRow[])
      : null;
  const { current, clanHistory } = detail;
  const displayName = detail.player.nickname;

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
