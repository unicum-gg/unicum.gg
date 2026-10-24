import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnicumError } from "@unicum.gg/sdk";
import { TOURNAMENT_GAME_MODE_LABEL, teamFormat } from "@unicum.gg/shared";
import { type Region, isRegion } from "@unicum.gg/wargaming";
import { TournamentView } from "@/components/tournaments/detail/view";
import type { TournamentRecord } from "@/components/tournaments/detail/record";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { unicum } from "@/services/sdk";

// ISR on the catalogue's own cadence, not dynamic. What this replaces rested on
// two premises, both measured false at the origin on 2026-10-24.
//
// The endpoint's `max-age=300` caches nothing we pay for: `getTournament` holds
// no server-side cache, the page's own server-side fetch is uncached, and the
// Cloudflare cache rule excludes `/api/` by design, so that header only ever
// reaches a caller hitting the API directly. Five consecutive reads of one
// tournament ran 69 to 273 ms with no decay, so the bracket really is rebuilt
// per view. And `force-dynamic` made Next answer `private, no-cache, no-store,
// must-revalidate` with no ETag over 1.1 MB of HTML, so nothing, the edge
// included, could hold a settled tournament that can never change again: 580 ms
// of CPU per request over 1,120 requests in forty minutes, re-paid on every hit
// by every crawler. The path already matches the zone's cache rule (it carries
// `contains "/tournaments"`), so the origin header was the only thing refusing.
//
// The unbounded-growth objection is gone too: entries live in a dedicated Redis
// under a TTL and an LRU key cap, never on the container disk, so the 2026-07-24
// disk fill cannot recur. That store does run at its ceiling (3.73 of 4.00 GiB,
// `allkeys-lru`, 1,972 entries averaging 1.89 MB), and the churn a crawler sweep
// adds is what `config/cache-handler.js` documents the dedicated instance for:
// the one-shot entity long tail is the oldest thing in it, so it is what LRU
// drops, and the leaderboards stay warm.
//
// 900s matches `/{region}/tournaments` one level up, and the window has to stay
// short for a reason the player pages do not share: `TournamentView` renders the
// payload it is handed and never refetches, so no `LiveSync` and no
// `revalidateOnMount` would correct a stale bracket on screen. The live cron
// re-mirrors an unsettled tournament every five minutes, so this is three of its
// cycles. A 404 on an unknown id is cached for the same window, self-healing and
// unreachable by navigation, since the only link to a tournament is the
// catalogue, cached on this very cadence.
export const dynamic = "force-static";
export const revalidate = 900; // 15 min, matches the catalogue page

async function loadTournament(
  region: Region,
  id: string,
): Promise<TournamentRecord | null> {
  try {
    return (await unicum
      .region(region)
      .tournaments(id)
      .detail()) as unknown as TournamentRecord;
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; id: string }>;
}): Promise<Metadata> {
  const { locale, region, id } = await params;
  if (!isRegion(region)) return {};
  const t = await loadTournament(region, id).catch(() => null);
  if (!t) return {};
  const regionLabel = region.toUpperCase();
  const modes = t.gameModes.map((m) => TOURNAMENT_GAME_MODE_LABEL[m]).join(", ");
  return constructMetadata({
    locale,
    title: `${t.title}, World of Tanks tournament (${regionLabel})`,
    description:
      `${t.title} on ${regionLabel}: ${t.confirmedTeams} teams in ${teamFormat(t.minPlayersInTeam)}` +
      `${modes ? ` ${modes}` : ""}, with the full bracket, every score and every roster.`,
    canonical: ROUTES.TOURNAMENT(region, t.id),
    ogImage: `/api/og/${region}/tournaments/${t.id}`,
  });
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ region: string; id: string }>;
}) {
  const { region, id } = await params;
  if (!isRegion(region)) notFound();
  const tournament = await loadTournament(region, id);
  if (!tournament) notFound();
  // The site's page container: every other page centres on it, and without it
  // the panels' side borders sit off-screen and the content runs edge to edge.
  return (
    <div className="mx-auto w-full max-w-7xl">
      <TournamentView region={region} tournament={tournament} />
    </div>
  );
}
