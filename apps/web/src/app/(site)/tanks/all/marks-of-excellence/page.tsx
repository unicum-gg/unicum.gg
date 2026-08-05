import type { Metadata } from "next";
import {
  renderTanksIndex,
  tanksIndexMetadata,
} from "@/app/(site)/[region]/tanks/page";
import { TankTab } from "@/components/tanks/list/tabs";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /tanks/marks-of-excellence mirrors /eu/tanks/marks-of-excellence.
export const dynamic = "force-static";
export const revalidate = 600;

export function generateMetadata(): Promise<Metadata> {
  return tanksIndexMetadata(Region.EU, TankTab.MarksOfExcellence);
}

export default async function TanksMoePageEU() {
  return renderTanksIndex(Region.EU, TankTab.MarksOfExcellence);
}
