import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  playerMetadata,
  renderPlayerPage,
} from "@/app/(site)/[region]/players/[nickname]/page";
import { playerViewFromSegment } from "@/components/players/detail/tabs";
import { isRegion } from "@unicum.gg/wargaming";

// One route per reachable profile view (the eight battle modes, plus Tanks and
// Value), so each is a page of its own with matching metadata instead of a
// `?section=` / `?tab=` query Google treats as a single page. A dynamic segment
// rather than ten near-identical files; the nickname space is unbounded, so
// nothing is enumerated here and an unknown segment 404s below.
//
// `/vs/[...rest]` is a static sibling, so it keeps winning over this route.
export const dynamic = "force-static";
export const revalidate = 86400; // 24h, matches the base player page

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; nickname: string; view: string }>;
}): Promise<Metadata> {
  const { region, nickname, view } = await params;
  const playerView = playerViewFromSegment(view);
  if (!playerView) return {};
  return playerMetadata(region, nickname, playerView);
}

export default async function PlayerViewPage({
  params,
}: {
  params: Promise<{ region: string; nickname: string; view: string }>;
}) {
  const { region, nickname, view } = await params;
  if (!isRegion(region)) notFound();
  const playerView = playerViewFromSegment(view);
  // The default view has a null segment, so it is only reachable at the bare
  // player path; reaching it here would be a duplicate URL.
  if (!playerView || !playerView.segment) notFound();
  return renderPlayerPage(region, decodeURIComponent(nickname), playerView);
}
