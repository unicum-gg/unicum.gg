import type { Metadata } from "next";
import { PlayersLandingView } from "@/components/players/players-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function languageDisplayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ language: string }>;
}): Promise<Metadata> {
  const { language } = await params;
  const name = languageDisplayName(language);
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `Strictly ${name} World of Tanks players (${label})`,
    description: `${APP.NAME} ${label} player leaderboard for players whose inferred clan-history language is exclusively ${name}, ranked by WNX.`,
    ogTitle: `Strictly ${name} players`,
    ogSubtitle: `${label} leaderboard`,
    canonical: ROUTES.PLAYERS_BY_LANGUAGE(Region.EU, language, true),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ language: string }>;
}) {
  const { language } = await params;
  return (
    <PlayersLandingView region={Region.EU} language={language} strict={true} />
  );
}

// Dynamic on purpose: the page consumes our own API through the SDK, and
// prerendering it at build time would make the build depend on a running API.
// The endpoints cache server-side, so per-request cost is local HTTP hops onto
// cached payloads.
export const dynamic = "force-dynamic";
