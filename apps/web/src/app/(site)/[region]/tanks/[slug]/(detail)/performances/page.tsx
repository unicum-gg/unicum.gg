import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  loadTankTab,
  tankMetadata,
} from "@/app/(site)/[region]/tanks/[slug]/(detail)/page";
import { Performances } from "@/components/tanks/detail/performances";
import { TankDetailTab } from "@/components/tanks/detail/tabs";
import { isRegion } from "@unicum.gg/wargaming";

// The Performances tab as its own route, so a render builds this tab alone
// instead of all three (see tabs.ts). Same ISR settings as the base page.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}): Promise<Metadata> {
  const { region, slug } = await params;
  return tankMetadata(region, slug, TankDetailTab.Performances);
}

export default async function TankPerformancesPage({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}) {
  const { region, slug } = await params;
  if (!isRegion(region)) notFound();
  const detail = await loadTankTab(region, slug, TankDetailTab.Performances);
  return (
    <Performances
      region={region}
      tankId={detail.tankId}
      meta={detail.meta}
      serverStats={detail.serverStats}
      topByMetric={detail.topByMetric}
      wn8Expected={detail.wn8Expected}
      wnxExpected={detail.wnxExpected}
    />
  );
}
