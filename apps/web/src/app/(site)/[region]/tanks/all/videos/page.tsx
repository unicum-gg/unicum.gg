import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  renderTanksIndex,
  tanksIndexMetadata,
} from "@/app/(site)/[region]/tanks/page";
import { TankTab } from "@/components/tanks/list/tabs";
import { isRegion } from "@unicum.gg/wargaming";

// The videos tab as its own route, like the other four (see
// components/tanks/list/tabs.ts). Same ISR settings as the base index: the list
// only changes when a moderator approves a suggestion, and that revalidates the
// tank pages already.
export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  return tanksIndexMetadata(region, TankTab.Videos);
}

export default async function TanksVideosPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  return renderTanksIndex(region, TankTab.Videos);
}
