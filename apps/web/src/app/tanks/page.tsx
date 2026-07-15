import type { Metadata } from "next";
import {
  generateMetadata as generateRegionMetadata,
  renderTanksIndex,
} from "@/app/[region]/tanks/page";
import { tankTabFromQuery } from "@/components/tanks/tabs";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /tanks renders the same index as /eu/tanks.
// Dynamic on purpose: the page reads searchParams (tab/sort) and consumes our
// own API through the SDK. The endpoints cache server-side, so the per-request
// cost is local HTTP hops onto cached payloads.
export const dynamic = "force-dynamic";

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
