import { notFound } from "next/navigation";
import { toRoman } from "roman-numerals";
import { isRegion } from "@unicum.gg/wargaming";
import type { TankSpec } from "@unicum.gg/shared";
import { JsonLd } from "@/components/json-ld";
import { TankShell } from "@/components/tanks/detail/shell";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { breadcrumbSchema, tankSchema } from "@/lib/schema-org";
import {
  availableTabs,
  loadTankDetail,
  loadTankVideos,
} from "@/app/(site)/[region]/tanks/[slug]/detail";

/**
 * What every tab of a tank page shares: the hero, the tab bar, and the video
 * player living behind them.
 *
 * A layout rather than four copies of the same header, because Next keeps it
 * mounted across the segments below it: a battle playing in the hero keeps
 * playing while the panel under it is replaced. Rendered per tab, as it was,
 * the player was torn down and the video started over on every tab change.
 *
 * The identity markup sits here for the same reason it is drawn here: the tank
 * and its breadcrumb are the same on all four tabs, so they are stated once.
 */
export default async function TankLayout({
  params,
  children,
}: {
  params: Promise<{ region: string; slug: string }>;
  children: React.ReactNode;
}) {
  const { region, slug } = await params;
  if (!isRegion(region)) notFound();

  const detail = await loadTankDetail(region, slug);
  // The canonical-slug redirect is left to the pages: they know which tab they
  // are, and the redirect has to land on the same one.
  if (!detail) notFound();

  const videos = await loadTankVideos(region, detail.slug);
  // Read off the detail payload rather than fetched. The badge needs a score
  // and a count, and this layout renders on every tab of every vehicle: asking
  // the ratings endpoint here was a second SSR self-fetch per render, pulling
  // back two histograms and thirty review bodies to print two numbers.
  // Defaulted rather than assumed. The detail payload is cached for a day and
  // is served by an API that can be one deploy behind this render, so a field
  // this young has to be allowed to be missing.
  const rating = detail.rating ?? { overall: null, votes: 0, reviewCount: 0 };
  const { meta } = detail;
  const tierLabel = meta.tier ? toRoman(meta.tier) : String(meta.tier);
  const tankUrl = `${APP.URL}${ROUTES.TANK(region, detail.slug)}`;

  return (
    <>
      <JsonLd
        data={tankSchema({
          name: meta.name,
          url: tankUrl,
          description: `${meta.name}, tier ${tierLabel} ${meta.nation.toUpperCase()} in World of Tanks. Server-average stats, best players and WN8/WNX expected values on ${region.toUpperCase()}.`,
          image: meta.bigIcon,
          tier: meta.tier,
          nation: meta.nation,
          type: meta.type,
          isPremium: meta.isPremium,
          // Only ever the plain mean and the real counts: `aggregateRating` is
          // a claim about what this page says, and the shrunk mean is a sort
          // key that appears nowhere on it.
          rating: {
            average: rating.overall,
            votes: rating.votes,
            reviews: rating.reviewCount,
          },
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: `${APP.URL}${ROUTES.HOME(region)}` },
          { name: "Tanks", url: `${APP.URL}${ROUTES.TANKS(region)}` },
          { name: meta.name, url: tankUrl },
        ])}
      />
      <TankShell
        region={region}
        slug={detail.slug}
        tankId={detail.tankId}
        meta={meta}
        specs={detail.specs as unknown as TankSpec | null}
        videos={videos}
        available={availableTabs(detail)}
        rating={{ overall: rating.overall, votes: rating.votes }}
      >
        {children}
      </TankShell>
    </>
  );
}
