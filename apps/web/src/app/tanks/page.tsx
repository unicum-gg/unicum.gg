import type { Metadata } from "next";
import {
  generateMetadata as generateRegionMetadata,
  renderTanksIndex,
} from "@/app/[region]/tanks/page";
import { tankTabFromQuery } from "@/components/tanks/tabs";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /tanks renders the same index as /eu/tanks.
export function generateMetadata(): Promise<Metadata> {
  return generateRegionMetadata({
    params: Promise.resolve({ region: Region.EU }),
  });
}

export default async function TanksIndexPageEU({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return renderTanksIndex(Region.EU, tankTabFromQuery(tab));
}
