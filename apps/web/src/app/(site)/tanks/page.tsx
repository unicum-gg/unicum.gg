import type { Metadata } from "next";
import {
  generateMetadata as generateRegionMetadata,
  renderTanksIndex,
} from "@/app/(site)/[region]/tanks/page";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /tanks renders the same index as /eu/tanks.
// ISR like the other landings: prerendered, revalidated in the background. The
// active tab and filters are read client-side from the URL, so no searchParams
// are needed.
export const dynamic = "force-static";
export const revalidate = 600;

export function generateMetadata(): Promise<Metadata> {
  return generateRegionMetadata({
    params: Promise.resolve({ region: Region.EU }),
  });
}

export default async function TanksIndexPageEU() {
  return renderTanksIndex(Region.EU);
}
