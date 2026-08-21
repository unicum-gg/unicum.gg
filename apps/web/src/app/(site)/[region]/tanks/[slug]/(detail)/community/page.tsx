import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isRegion } from "@unicum.gg/wargaming";
import { loadTankRatings } from "@/app/(site)/[region]/tanks/[slug]/detail";
import {
  loadTankTab,
  tankMetadata,
} from "@/app/(site)/[region]/tanks/[slug]/(detail)/page";
import { JsonLd } from "@/components/json-ld";
import { CommunityTab } from "@/components/tanks/detail/community";
import { TankDetailTab } from "@/components/tanks/detail/tabs";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { tankReviewsSchema } from "@/lib/schema-org";

// The Community tab as its own route, so a render builds this tab alone instead
// of all of them (see tabs.ts). Same ISR settings as the base page: the verdict
// is cached HTML, and a vote drops it from the cache through the rating
// endpoint's own `revalidatePath`, so a new star shows without waiting out the
// window. The form inside is a client component reading its own uncached state,
// which is what keeps one reader's vote out of everyone else's page.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}): Promise<Metadata> {
  const { region, slug } = await params;
  return tankMetadata(region, slug, TankDetailTab.Community);
}

export default async function TankCommunityPage({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}) {
  const { region, slug } = await params;
  if (!isRegion(region)) notFound();
  const [detail, summary] = await Promise.all([
    loadTankTab(region, slug, TankDetailTab.Community),
    loadTankRatings(region, slug),
  ]);
  const tankUrl = `${APP.URL}${ROUTES.TANK(region, detail.slug)}`;
  // Attached to the vehicle by `@id`, so it joins the Product the layout emits
  // rather than describing a second one. Emitted here and nowhere else: the
  // review text lives on this tab, and structured data may only state what the
  // page actually shows.
  const reviews = tankReviewsSchema({
    tankName: detail.meta.name,
    tankUrl,
    reviews: summary.reviews.map((r) => ({
      author: r.nickname,
      authorUrl: `${APP.URL}${ROUTES.PLAYER(r.region, r.nickname)}`,
      rating: r.overall,
      body: r.body,
      datePublished: r.createdAt,
    })),
  });

  return (
    <>
      {reviews ? <JsonLd data={reviews} /> : null}
      <CommunityTab
        region={region}
        slug={detail.slug}
        tankName={detail.meta.name}
        tier={detail.meta.tier}
        summary={summary}
      />
    </>
  );
}
