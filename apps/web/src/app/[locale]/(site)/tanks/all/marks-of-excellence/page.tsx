import type { Metadata } from "next";
import {
  renderTanksIndex,
  tanksIndexMetadata,
} from "@/app/[locale]/(site)/[region]/tanks/page";
import { TankTab } from "@/components/tanks/list/tabs";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /tanks/marks-of-excellence mirrors /eu/tanks/marks-of-excellence.
export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return tanksIndexMetadata(Region.EU, TankTab.MarksOfExcellence, locale);
}

export default async function TanksMoePageEU({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return renderTanksIndex(Region.EU, locale, TankTab.MarksOfExcellence);
}
