import type { Metadata } from "next";
import {
  renderTanksIndex,
  tanksIndexMetadata,
} from "@/app/[locale]/(site)/[region]/tanks/page";
import { TankTab } from "@/components/tanks/list/tabs";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /tanks renders the same index as /eu/tanks.
// ISR like the other landings: prerendered, revalidated in the background. Each
// tab is its own route segment; the filters are read client-side from the URL,
// so no searchParams are needed.
export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return tanksIndexMetadata(Region.EU, TankTab.Performances, locale);
}

export default async function TanksIndexPageEU({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return renderTanksIndex(Region.EU, locale, TankTab.Performances);
}
