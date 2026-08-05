import type { Metadata } from "next";
import {
  renderTanksIndex,
  tanksIndexMetadata,
} from "@/app/(site)/[region]/tanks/page";
import { TankTab } from "@/components/tanks/list/tabs";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /tanks/economics mirrors /eu/tanks/economics.
export const dynamic = "force-static";
export const revalidate = 600;

export function generateMetadata(): Promise<Metadata> {
  return tanksIndexMetadata(Region.EU, TankTab.Economics);
}

export default async function TanksEconomicsPageEU() {
  return renderTanksIndex(Region.EU, TankTab.Economics);
}
