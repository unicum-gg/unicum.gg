import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  DEFAULT_PLAYER_VIEW,
  PlayerMode,
  PlayerSection,
  type PlayerView,
  playerViewHref,
} from "@/components/players/detail/tabs";
import { PlayerProfile } from "@/components/players/detail/view";
import { AccountLockedView } from "@/components/players/detail/account-locked";
import type { PlayerTournamentRecord } from "@/components/players/detail/tournaments/row";
import type { PlayerOnslaughtData } from "@/components/players/detail/onslaught";
import { JsonLd } from "@/components/json-ld";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { breadcrumbSchema, personSchema } from "@/lib/schema-org";
import { styles } from "@/lib/styles";
import { unicum } from "@/services/sdk";
import { UnicumError } from "@unicum.gg/sdk";
import {
  SessionGranularity,
  type PlayerAchievements,
  type PlayerDetailData,
  type PlayerSession,
  type PlayerTankRecord,
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
// 24h, not 30 min. Cloudflare honors the origin `s-maxage` (verified: pages
// expire at their own s-maxage), so a short window meant every first hit per
// entity per 30 min paid a full origin regen (measured 0.7-11s) while the huge
// entity space kept CF cache coverage thin. A day-long window keeps a visited
// profile a CF HIT (~55ms) far longer, so regens are rare. Freshness is not lost
// to the long cache: `PlayerProfile` refetches the live payload on mount
// (`revalidateOnMount`) and LiveSync patches ticks, so the visible stats are
// current even when the cached HTML shell is up to a day old (which only the OG
// image and title lag by, and that is fine for a stats tracker's SEO).
export const revalidate = 86400; // 24h

/** Wording for the view being rendered, so each mode is a page of its own
 * rather than nine copies of the same title. */
function viewCopy(
  view: PlayerView,
  name: string,
  regionLabel: string,
  battles: string,
  winrate: string,
  rating: string,
  medals: string,
): { title: string; description: string } {
  if (view.section === PlayerSection.Tanks) {
    return {
      title: `${name} tanks (${regionLabel}), every vehicle played`,
      description: `Every tank ${name} has played on ${regionLabel}, with battles, win rate, average damage and WN8 per vehicle.`,
    };
  }
  if (view.section === PlayerSection.Achievements) {
    return {
      title: `${name} achievements (${regionLabel}), ${medals} medals earned`,
      description: `The ${medals} World of Tanks medals ${name} has earned on ${regionLabel}, from Kolobanov's and Pool's to the honorary ranks and epic medals, plus every one still left to earn.`,
    };
  }
  if (view.section === PlayerSection.Tournaments) {
    return {
      title: `${name} tournaments (${regionLabel})`,
      description: `Every Wargaming tournament ${name} has entered on ${regionLabel}: the team they played for, the format, and how far it got. A record Wargaming publishes from the tournament's side only, never the player's.`,
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

  // The medal cabinet is kept out of the index. Not because it is a tab —
  // Tanks and Value are indexed and should be — but because of what is
  // actually on it: ~126 of the player's own counts against 510 catalogue
  // entries whose names, descriptions and conditions are byte-identical on
  // every player's page. Indexed across 2M profiles that is ~250 KB of the
  // same Wargaming boilerplate repeated two million times, competing for crawl
  // budget with the pages that do rank, and answering a query nobody types
  // (people search the nickname, which the profile already serves).
  //
  // `constructMetadata` pairs noindex with nofollow. That costs nothing here:
  // every link on this page (the tab nav, the clan, the Twitch profile) also
  // sits on the profile itself, which is indexed and followed, so no link is
  // stranded by not being crawled from this one.
  const noIndex = view.section === PlayerSection.Achievements;

  const { current } = detail;
  const copy = viewCopy(
    view,
    displayName,
    regionLabel,
    intFmt.format(current.battles),
    pctFmt.format((current.wins / current.battles) * 100),
    intFmt.format(current.wtr ?? current.globalRating),
    intFmt.format(detail.achievementCount),
  );
  return constructMetadata({
    title: copy.title,
    description: copy.description,
    ogImage: `/api/og/${region}/players/${encodeURIComponent(decoded)}`,
    canonical: playerViewHref(ROUTES.PLAYER(region, decoded), view),
    noIndex,
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
  /** A vehicle slug, when the URL names one: `/players/Animal/tanks/is-7`
   * opens the Tanks view with that record beside the table. */
  tankSlug?: string,
) {
  return (
    <PlayerProfileServer
      region={region}
      decoded={decoded}
      view={view}
      tankSlug={tankSlug}
    />
  );
}

/** The data-dependent half of the page. Its `loadDetail` await blocks the render
 * so the static prerender captures the full profile (see the note above). */
async function PlayerProfileServer({
  region,
  decoded,
  view,
  tankSlug,
}: {
  region: Region;
  decoded: string;
  view: PlayerView;
  tankSlug?: string;
}) {
  const { section, mode } = view;
  const detail = await loadDetail(region, decoded);
  if (detail && "locked" in detail) {
    return <AccountLockedView nickname={detail.nickname} region={region} />;
  }
  if (!detail) notFound();

  // Send the visitor to the nickname this account actually goes by. Two cases
  // land here: a different casing (the lookup is case-insensitive, so
  // `/players/animal` resolves but would otherwise sit at its own URL), and a
  // nickname the player has since dropped (the endpoint resolves those through
  // the rename history instead of 404ing).
  //
  // Temporary on purpose. A freed nickname can be claimed by somebody else, and
  // a permanent redirect would be cached by browsers long after that happened,
  // stranding the new owner behind the old one's profile.
  if (detail.player.nickname !== decoded) {
    redirect(
      playerViewHref(ROUTES.PLAYER(region, detail.player.nickname), view),
    );
  }

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
  // Same treatment for the medal cabinet: server-rendered when the visitor
  // landed straight on `/achievements`, so a crawler (and the first paint) get
  // the grid rather than a placeholder. Null on every other section, and the
  // client fetches it when the tab is first opened.
  const initialAchievements: PlayerAchievements | null =
    section === PlayerSection.Achievements
      ? ((await unicum
          .region(region)
          .players(decoded)
          .achievements()) as unknown as PlayerAchievements)
      : null;
  // The open vehicle record, rendered on the server like the list beside it: it
  // is the subject of its own URL, so it belongs in the HTML a crawler and the
  // `.md` twin read, not in a fetch after hydration. `buildSafe` is not wanted
  // here: a slug the player has never played is a 404, not an empty shell.
  // Same treatment again for the sessions list: server-rendered on a direct
  // landing so a crawler and the `.md` twin read the table rather than its
  // skeleton, and only in the bucket size the tab opens on.
  // Same treatment for the tournament record: server-rendered on a direct
  // landing so a crawler and the `.md` twin read the table rather than its
  // skeleton.
  //
  // Caught rather than awaited bare, because the endpoint DOES 404: it resolves
  // the nickname against our own players table, while the profile around it
  // resolves live through Wargaming, so a player renamed since our last refresh
  // has a working page and no row under that name. Letting that throw took the
  // whole profile down over a tab. An absent record is a good answer anyway
  // (most accounts have never entered one) and the browser re-fetches on mount.
  const initialTournaments: PlayerTournamentRecord | null =
    section === PlayerSection.Tournaments
      ? await unicum
          .region(region)
          .players(decoded)
          .tournaments()
          .then((r) => r as unknown as PlayerTournamentRecord)
          .catch(() => null)
      : null;
  // Same treatment for the Onslaught record, and it is a MODE rather than a
  // section, so it keys off the mode row instead. Caught for the same reason as
  // the tournaments above: this endpoint resolves the nickname against our own
  // players table while the profile around it resolves live through Wargaming,
  // so a player renamed since our last refresh has a working page and no row
  // under that name, and letting that throw would take the profile down over a
  // mode.
  const initialOnslaught: PlayerOnslaughtData | null =
    mode === PlayerMode.Onslaught
      ? await unicum
          .region(region)
          .players(decoded)
          .onslaught()
          .then((r) => r as unknown as PlayerOnslaughtData)
          .catch(() => null)
      : null;
  const initialSessions: PlayerSession[] | null =
    section === PlayerSection.Sessions
      ? ((
          await unicum
            .region(region)
            .players(decoded)
            .sessions(SessionGranularity.Daily)
        ).sessions as unknown as PlayerSession[])
      : null;
  const tankDetail: PlayerTankRecord | null = tankSlug
    ? await unicum
        .region(region)
        .players(decoded)
        .tank(tankSlug)
        .then((d) => d as unknown as PlayerTankRecord)
        .catch((err) => {
          if (err instanceof UnicumError && err.status === 404) notFound();
          throw err;
        })
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
        tankDetail={tankDetail}
        initialSessions={initialSessions}
        initialAchievements={initialAchievements}
        initialTournaments={initialTournaments}
        initialOnslaught={initialOnslaught}
      />
      {/* Fills the leftover height on short tabs (e.g. Value) so the side
          borders run down to the footer instead of stopping at the last panel,
          mirroring the footer's own bordered spacer. Collapses to 0 when the
          content already fills the viewport. */}
      <div aria-hidden className={`flex-1 ${styles.borderX}`} />
    </div>
  );
}
