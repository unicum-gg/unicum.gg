import type { Metadata } from "next";
import {
  generateMetadata as generateRegionMetadata,
  renderMapsIndex,
} from "@/app/(site)/[region]/maps/page";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /maps renders the same index as /eu/maps. ISR like the other
// landings.
export const dynamic = "force-static";
export const revalidate = 3600;

export function generateMetadata(): Promise<Metadata> {
  return generateRegionMetadata({
    params: Promise.resolve({ region: Region.EU }),
  });
}

export default async function MapsIndexPageEU() {
  return renderMapsIndex(Region.EU);
}
