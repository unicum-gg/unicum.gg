import type { Metadata } from "next";
import { maneuversPlayersMetadata } from "@/app/[locale]/(site)/[region]/players/maneuvers/page";
import { ManeuversPlayersView } from "@/components/players/list/maneuvers/view";
import { Region } from "@unicum.gg/wargaming";
import { withDictionaries } from "@/components/dictionaries";

export const dynamic = "force-static";
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // The EU shortcut is the regional page at its region-less address, so it says
  // exactly what that page says rather than keeping a second copy of it.
  return maneuversPlayersMetadata(Region.EU, locale);
}

async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ManeuversPlayersView locale={locale} region={Region.EU} />;
}

export default withDictionaries("[locale]/(site)/players/maneuvers", Page);
