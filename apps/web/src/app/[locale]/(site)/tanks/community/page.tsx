import type { Metadata } from "next";
import { tankCommunityMetadata } from "@/app/[locale]/(site)/[region]/tanks/community/page";
import { TankCommunityView } from "@/components/tanks/list/community/view";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /tanks/community renders the same board as /eu/tanks/community.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // The EU shortcut is the regional page at its region-less address, which the
  // route helpers already answer with, so it says exactly what the page it is a
  // shortcut for says. It used to say it in a copy of that call, which is how
  // two of them ended up interpolating one value fewer than the string they
  // were reading asked for, and printing the placeholder at a reader.
  return tankCommunityMetadata(Region.EU, locale);
}

export default async function TankCommunityPageEU({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TankCommunityView locale={locale} region={Region.EU} page={1} />;
}
