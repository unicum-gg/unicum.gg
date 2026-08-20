import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadTankHistory } from "@/app/(site)/[region]/tanks/[slug]/detail";
import {
  loadTankTab,
  tankMetadata,
} from "@/app/(site)/[region]/tanks/[slug]/(detail)/page";
import { TankChangesHistory } from "@/components/tanks/detail/history";
import { TankDetailTab } from "@/components/tanks/detail/tabs";
import { isRegion } from "@unicum.gg/wargaming";

// The History tab as its own route, so a render builds this tab alone instead of
// all of them (see tabs.ts). Same ISR settings as the base page.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}): Promise<Metadata> {
  const { region, slug } = await params;
  return tankMetadata(region, slug, TankDetailTab.History);
}

export default async function TankHistoryPage({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}) {
  const { region, slug } = await params;
  if (!isRegion(region)) notFound();
  const [detail, history] = await Promise.all([
    loadTankTab(region, slug, TankDetailTab.History),
    loadTankHistory(region, slug),
  ]);
  return (
    <TankChangesHistory
      versions={history.versions}
      devVersion={history.devVersion}
      devAt={history.devAt}
      releasedVersion={history.releasedVersion}
      releasedAt={history.releasedAt}
      tankName={detail.meta.name}
    />
  );
}
