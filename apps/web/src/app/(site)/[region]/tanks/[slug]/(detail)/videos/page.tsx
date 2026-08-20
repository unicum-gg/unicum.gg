import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  loadTankTab,
  tankMetadata,
  TankVideosJsonLd,
} from "@/app/(site)/[region]/tanks/[slug]/(detail)/page";
import { loadTankVideos } from "@/app/(site)/[region]/tanks/[slug]/detail";
import { TankVideosTab } from "@/components/tanks/detail/videos";
import { TankDetailTab } from "@/components/tanks/detail/tabs";
import { isRegion } from "@unicum.gg/wargaming";

// The Videos tab as its own route, so a render builds this tab alone instead of
// all of them (see tabs.ts). The cached shell can lag an approval and the CDN
// edge holds it past `revalidatePath` (which only drops Next's copy, not the
// edge), but the list is revalidated in the browser by the shell's
// `TankVideosLiveProvider`, so a freshly approved video shows without waiting
// the window out. Same cadence as the base page.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}): Promise<Metadata> {
  const { region, slug } = await params;
  return tankMetadata(region, slug, TankDetailTab.Videos);
}

export default async function TankVideosPage({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}) {
  const { region, slug } = await params;
  if (!isRegion(region)) notFound();
  const detail = await loadTankTab(region, slug, TankDetailTab.Videos);
  const videos = await loadTankVideos(region, detail.slug);
  return (
    <>
      <TankVideosJsonLd tankName={detail.meta.name} videos={videos} />
      <TankVideosTab
        region={region}
        slug={detail.slug}
        tankName={detail.meta.name}
        videos={videos}
      />
    </>
  );
}
