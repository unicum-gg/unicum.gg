import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  renderTanksIndex,
  tanksIndexMetadata,
} from "@/app/[locale]/(site)/[region]/tanks/page";
import { TankTab } from "@/components/tanks/list/tabs";
import { isRegion } from "@unicum.gg/wargaming";

// The marks-of-mastery tab as its own route, so the server embeds this tab's data group
// instead of always shipping Performances and letting the client fetch on top
// (see components/tanks/list/tabs.ts). Same ISR settings as the base index.
export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  return tanksIndexMetadata(region, TankTab.MarksOfMastery, locale);
}

export default async function TanksMasteryPage({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}) {
  const { locale, region } = await params;
  if (!isRegion(region)) notFound();
  return renderTanksIndex(region, locale, TankTab.MarksOfMastery);
}
