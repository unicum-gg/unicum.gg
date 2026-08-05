import type { Metadata } from "next";
import {
  renderTanksIndex,
  tanksIndexMetadata,
} from "@/app/(site)/[region]/tanks/page";
import { TankTab } from "@/components/tanks/list/tabs";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /tanks renders the same index as /eu/tanks.
// ISR like the other landings: prerendered, revalidated in the background. Each
// tab is its own route segment; the filters are read client-side from the URL,
// so no searchParams are needed.
export const dynamic = "force-static";
export const revalidate = 600;

export function generateMetadata(): Promise<Metadata> {
  return tanksIndexMetadata(Region.EU, TankTab.Performances);
}

export default async function TanksIndexPageEU() {
  return renderTanksIndex(Region.EU, TankTab.Performances);
}
