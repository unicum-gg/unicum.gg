import type { Metadata } from "next";
import {
  renderTanksIndex,
  tanksIndexMetadata,
} from "@/app/(site)/[region]/tanks/page";
import { TankTab } from "@/components/tanks/list/tabs";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /tanks/marks-of-mastery mirrors /eu/tanks/marks-of-mastery.
export const dynamic = "force-static";
export const revalidate = 600;

export function generateMetadata(): Promise<Metadata> {
  return tanksIndexMetadata(Region.EU, TankTab.MarksOfMastery);
}

export default async function TanksMasteryPageEU() {
  return renderTanksIndex(Region.EU, TankTab.MarksOfMastery);
}
