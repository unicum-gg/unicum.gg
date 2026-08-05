import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  clanMetadata,
  renderClanPage,
} from "@/app/(site)/[region]/clans/[tag]/page";
import { clanViewFromSegment } from "@/components/clans/detail/tabs";
import { isRegion } from "@unicum.gg/wargaming";

// One route per reachable clan view (stronghold, clan-wars, tanks, manage), so
// each is a page of its own with matching metadata instead of a `?section=` /
// `?tab=` query Google treats as a single page. A dynamic segment rather than
// four near-identical files; the tag space is unbounded, so nothing is
// enumerated here and an unknown segment 404s below.
//
// `/vs/[...rest]` is a static sibling, so it keeps winning over this route.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min, matches the base clan page

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; tag: string; view: string }>;
}): Promise<Metadata> {
  const { region, tag, view } = await params;
  const clanView = clanViewFromSegment(view);
  if (!clanView) return {};
  return clanMetadata(region, tag, clanView);
}

export default async function ClanViewPage({
  params,
}: {
  params: Promise<{ region: string; tag: string; view: string }>;
}) {
  const { region, tag, view } = await params;
  if (!isRegion(region)) notFound();
  const clanView = clanViewFromSegment(view);
  // The default view has a null segment, so it is only reachable at the bare
  // clan path; reaching it here would be a duplicate URL.
  if (!clanView || !clanView.segment) notFound();
  return renderClanPage(region, decodeURIComponent(tag), clanView);
}
