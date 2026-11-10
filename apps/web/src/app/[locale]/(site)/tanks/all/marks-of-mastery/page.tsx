import type { Metadata } from "next";
import {
  renderTanksIndex,
  tanksIndexMetadata,
} from "@/app/[locale]/(site)/[region]/tanks/page";
import { TankTab } from "@/components/tanks/list/tabs";
import { Region } from "@unicum.gg/wargaming";
import { withDictionaries } from "@/components/dictionaries";

// EU shortcut: /tanks/marks-of-mastery mirrors /eu/tanks/marks-of-mastery.
export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return tanksIndexMetadata(Region.EU, TankTab.MarksOfMastery, locale);
}

async function TanksMasteryPageEU({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return renderTanksIndex(Region.EU, locale, TankTab.MarksOfMastery);
}

export default withDictionaries(
  "[locale]/(site)/tanks/all/marks-of-mastery",
  TanksMasteryPageEU,
);
