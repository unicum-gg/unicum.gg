import type { Metadata } from "next";
import {
  renderTanksIndex,
  tanksIndexMetadata,
} from "@/app/[locale]/(site)/[region]/tanks/page";
import { TankTab } from "@/components/tanks/list/tabs";
import { Region } from "@unicum.gg/wargaming";
import { withDictionaries } from "@/components/dictionaries";

// EU shortcut: /tanks/specifications mirrors /eu/tanks/specifications.
export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return tanksIndexMetadata(Region.EU, TankTab.Specifications, locale);
}

async function TanksSpecificationsPageEU({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return renderTanksIndex(Region.EU, locale, TankTab.Specifications);
}

export default withDictionaries(
  "[locale]/(site)/tanks/all/specifications",
  TanksSpecificationsPageEU,
);
