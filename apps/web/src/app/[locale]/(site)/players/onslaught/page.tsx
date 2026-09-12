import type { Metadata } from "next";
import { OnslaughtView } from "@/components/players/list/onslaught/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

// ISR like the other leaderboards: the page renders the current season and is
// cached, so it is a cheap read instead of re-rendering the whole ~4k-row board
// on every request. The season selector's `?season=` is read client-side (see
// OnslaughtBoardLive), so it no longer opts the page into dynamic rendering.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min, matches the other boards

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await getTranslation("app/players/onslaught/page", locale);
  const { t: tGame } = await getTranslation("game/vocabulary", locale);

  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    locale,
    title: t("title", { region: label, mode: tGame("player-modes.onslaught") }),
    description: t("description", { name: APP.NAME, region: label }),
    ogTitle: t("og-title", { mode: tGame("player-modes.onslaught") }),
    ogSubtitle: t("og-subtitle", { region: label }),
    canonical: ROUTES.PLAYERS_ONSLAUGHT(Region.EU),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <OnslaughtView locale={locale} region={Region.EU} />;
}
