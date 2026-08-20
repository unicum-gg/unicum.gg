import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  loadTankTab,
  tankMetadata,
} from "@/app/(site)/[region]/tanks/[slug]/(detail)/page";
import { TankMarksMastery } from "@/components/tanks/detail/marks/mastery";
import { TankDetailTab } from "@/components/tanks/detail/tabs";
import { isRegion } from "@unicum.gg/wargaming";

// The Marks tab as its own route, so a render builds this tab alone instead of
// all three (see tabs.ts). Same ISR settings as the base page.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}): Promise<Metadata> {
  const { region, slug } = await params;
  return tankMetadata(region, slug, TankDetailTab.Marks);
}

export default async function TankMarksPage({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}) {
  const { region, slug } = await params;
  if (!isRegion(region)) notFound();
  const detail = await loadTankTab(region, slug, TankDetailTab.Marks);
  return (
    <TankMarksMastery
      moe={detail.moe}
      mom={detail.mom}
      moeHistory={detail.moeHistory}
      momHistory={detail.momHistory}
      serverStats={detail.serverStats}
      tankName={detail.meta.name}
    />
  );
}
