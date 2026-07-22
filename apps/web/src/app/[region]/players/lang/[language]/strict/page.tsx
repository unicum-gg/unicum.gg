import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlayersLandingView } from "@/components/players/list/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function languageDisplayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; language: string }>;
}): Promise<Metadata> {
  const { region, language } = await params;
  if (!isRegion(region)) return {};
  const name = languageDisplayName(language);
  const label = REGION_LABEL[region];
  return constructMetadata({
    title: `Strictly ${name} World of Tanks players (${label})`,
    description: `${APP.NAME} ${label} player leaderboard for players whose inferred clan-history language is exclusively ${name}, ranked by WNX.`,
    ogTitle: `Strictly ${name} players`,
    ogSubtitle: `${label} leaderboard`,
    canonical: ROUTES.PLAYERS_BY_LANGUAGE(region, language, true),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ region: string; language: string }>;
}) {
  const { region, language } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) {
    redirect(ROUTES.PLAYERS_BY_LANGUAGE(Region.EU, language, true));
  }
  return (
    <PlayersLandingView region={region} language={language} strict={true} />
  );
}

// ISR: served as prerendered HTML and revalidated in the background, so
// navigation stays instant while the data follows the endpoints' cadence.
// Language params are generated on demand (no build-time prerender, so the
// build never depends on a running API) and cached between revalidations.
export const dynamic = "force-static";
export const revalidate = 600;
