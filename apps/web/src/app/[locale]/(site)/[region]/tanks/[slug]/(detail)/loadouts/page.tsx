import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isRegion } from "@unicum.gg/wargaming";
import { loadTankLoadouts } from "@/app/[locale]/(site)/[region]/tanks/[slug]/detail";
import {
  loadTankTab,
  tankMetadata,
} from "@/app/[locale]/(site)/[region]/tanks/[slug]/(detail)/page";
import { LoadoutsTab } from "@/components/tanks/detail/loadouts";
import { PanelSeparator } from "@/components/panel";
import { TwinsView } from "@/components/tanks/detail/twins/control";
import { TwinsPanel } from "@/components/tanks/detail/twins/panel";
import { TankDetailTab } from "@/components/tanks/detail/tabs";
import { withDictionaries } from "@/components/dictionaries";

// The Loadouts tab as its own route, like every other tab, so a render builds
// this one alone (see tabs.ts). ISR on the same window as the rest: an upload
// lands when a player's client next speaks, which is minutes to hours, and
// nothing on this page is watching for its own write to appear. The mode
// switch inside is client state over markup this render already produced, so
// it needs no searchParams and the page stays static.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, region, slug } = await params;
  return tankMetadata(region, slug, TankDetailTab.Loadouts, locale);
}

async function TankLoadoutsPage({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}) {
  const { locale, region, slug } = await params;
  if (!isRegion(region)) notFound();
  const [detail, modes] = await Promise.all([
    loadTankTab(region, slug, TankDetailTab.Loadouts, locale),
    loadTankLoadouts(region, slug, locale),
  ]);
  const own = (
    <LoadoutsTab
      region={region}
      slug={detail.slug}
      tankId={detail.tankId}
      tankName={detail.meta.name}
      modes={modes}
      locale={locale}
    />
  );
  if (detail.twins.length === 0) return own;

  // Both readings rendered here, the switch picking one on the client, for the
  // same reason the modes are: the page is static and cannot see `?twins=`.
  const withTwins = await loadTankLoadouts(region, detail.slug, locale, true);
  return (
    <>
      <TwinsPanel
        region={region}
        tankName={detail.meta.name}
        twins={detail.twins}
        tab="/loadouts"
        locale={locale}
      />
      <PanelSeparator />
      <TwinsView
        own={own}
        combined={
          <LoadoutsTab
            region={region}
            slug={detail.slug}
            tankId={detail.tankId}
            // Named for every vehicle it counts, like the Performances tab.
            tankName={[detail.meta.name, ...detail.twins.map((twin) => twin.name)].join(" + ")}
            modes={withTwins}
            twins={Object.fromEntries(
              detail.twins.map((twin) => [twin.tankId, { slug: twin.slug, name: twin.name }]),
            )}
            locale={locale}
          />
        }
      />
    </>
  );
}

export default withDictionaries(
  "[locale]/(site)/[region]/tanks/[slug]/(detail)/loadouts",
  TankLoadoutsPage,
);
