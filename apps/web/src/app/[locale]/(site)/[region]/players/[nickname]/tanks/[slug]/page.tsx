import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  playerMetadata,
  renderPlayerPage,
} from "@/app/[locale]/(site)/[region]/players/[nickname]/page";
import {
  PLAYER_VIEWS,
  PlayerSection,
} from "@/components/players/detail/tabs";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { unicum, unicumPublic } from "@/services/sdk";
import { isRegion } from "@unicum.gg/wargaming";
import type { PlayerTankDetail } from "@unicum.gg/shared";

// One player's record on one vehicle: the Tanks view with that record open
// beside the table, at a URL of its own so it can be linked and shared.
//
// A static `tanks/` sibling of the `[view]` segment, which keeps serving the
// bare `/tanks` list: a path only matches a route that has a page at its own
// depth, and this one has none at `tanks/`.
//
// ISR on the same cadence as the base player page and the `[view]` sibling,
// both of which render through the `renderPlayerPage` imported above. That page
// documents why the profile render is static and why the window is a day, and
// every word of it applies here: same render, same metric-agnostic payload,
// same `LiveSync` hot-swap and per-hit refresh enqueue, no cookie, no
// `searchParams`, no `Date.now()`. This route was simply left behind on
// `force-dynamic` when the others moved, so Next answered `private, no-cache,
// no-store, must-revalidate` with no ETag, and nothing, the edge included, was
// allowed to hold the result.
//
// What that cost, measured on 2026-10-24 under a crawler sweep: 2,915 ms of CPU
// per request at 5.2 requests a second, the heaviest route on the site by a
// factor of three over the next one, which saturated the event loop (89 stalls
// in ten minutes, up to 14 s each) while player pages timed out at 40 s. The
// only link to a vehicle record is the player's own tanks table, cached on the
// same day, so nobody reaches one before the table naming it has refreshed,
// which is also why a cached 404 for a tank acquired since the last render is
// unreachable by navigation.
export const dynamic = "force-static";
export const revalidate = 86400; // 24h, matches the player page and `[view]`

const TANKS_VIEW = PLAYER_VIEWS.find(
  (v) => v.section === PlayerSection.Tanks,
)!;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; nickname: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, region, nickname, slug } = await params;
  if (!isRegion(region)) return {};
  const decoded = decodeURIComponent(nickname);

  // The record itself, so the title says which tank rather than repeating the
  // profile's. A player who never played it has no page here, and the base
  // metadata is the honest fallback while the page below 404s.
  const detail = await unicum
    .region(region)
    .players(decoded)
    .tank(slug, locale)
    .then((d) => d as unknown as PlayerTankDetail)
    .catch(() => null);
  if (!detail) return playerMetadata(region, nickname, TANKS_VIEW, locale);

  const name = detail.shortName || detail.name;
  const regionLabel = region.toUpperCase();
  const pct = ((detail.winrate * 100).toFixed(1));
  return constructMetadata({
    locale,
    title: `${decoded}'s ${name} stats (${regionLabel})`,
    description: `${decoded} on the ${detail.name} in World of Tanks (${regionLabel}): ${detail.battles} battles, ${pct}% winrate, ${Math.round(detail.avgDamage)} average damage, WN8 and WNX on this vehicle.`,
    ogImage: unicumPublic.og
      .region(region)
      .players(decoded)
      .url()
      .replace(/^https?:\/\/[^/]+/, ""),
    canonical: ROUTES.PLAYER_TANK(region, decoded, slug),
  });
}

export default async function PlayerTankPage({
  params,
}: {
  params: Promise<{ locale: string; region: string; nickname: string; slug: string }>;
}) {
  const { locale, region, nickname, slug } = await params;
  if (!isRegion(region)) notFound();
  return renderPlayerPage(
    region,
    decodeURIComponent(nickname),
    TANKS_VIEW,
    locale,
    slug,
  );
}
