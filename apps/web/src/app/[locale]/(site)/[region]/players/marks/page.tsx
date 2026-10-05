import type { Metadata } from "next";
import { localizePath } from "@/lib/translations";
import { notFound, redirect } from "next/navigation";
import { MarksLandingView } from "@/components/players/list/marks/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

// ISR, like the boards beside it: prerendered HTML revalidated in the
// background, so navigation stays instant while the counts follow the refreshes
// that write them.
export const dynamic = "force-static";
export const revalidate = 1800;

export function generateStaticParams() {
  // EU lives at /players/marks; only NA and ASIA are enumerated here.
  return [{ region: Region.NA }, { region: Region.ASIA }];
}

/**
 * This section's own metadata, shared by three routes: the regional page, the
 * EU shortcut at its region-less address, and the `/page/[n]` the proxy sends
 * `?page=` to. The last one rewrites every address this declares, so a
 * paginated page cannot drift from the section it is a page of.
 */
export async function playerMarksMetadata(
  region: Region,
  locale: string,
): Promise<Metadata> {
  const label = REGION_LABEL[region];
  const { t } = await getTranslation("app/players/marks/page", locale);
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  // Wargaming's own name for the thing being counted, in the reader's
  // language, rather than a string of ours saying it a second way.
  const marks = tGame("marks.3");
  return constructMetadata({
    locale,
    title: t("title", { region: label, marks }),
    description: t("description", { name: APP.NAME, region: label, marks }),
    ogTitle: t("og-title", { marks }),
    ogSubtitle: t("og-subtitle", { region: label }),
    canonical: ROUTES.PLAYERS_MARKS(region),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  if (!isRegion(region)) return {};
  return playerMarksMetadata(region, locale);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}) {
  const { locale, region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) {
    redirect(localizePath(ROUTES.PLAYERS_MARKS(Region.EU), locale));
  }
  return (
    <MarksLandingView
      locale={locale}
      region={region}
      language={null}
      page={1}
    />
  );
}
