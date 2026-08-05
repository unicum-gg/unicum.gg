import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  renderTanksIndex,
  tanksIndexMetadata,
} from "@/app/(site)/[region]/tanks/page";
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
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  return tanksIndexMetadata(region, TankTab.MarksOfMastery);
}

export default async function TanksMasteryPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  return renderTanksIndex(region, TankTab.MarksOfMastery);
}
