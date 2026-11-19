import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isRegion, Region } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { localizePath } from "@/lib/translations";
import { getTranslation } from "@/lib/translations.server";
import { withDictionaries } from "@/components/dictionaries";
import { BattlesView } from "@/components/battles/list/view";

// ISR like the other catalogue pages: the first page in the default order is
// prerendered so a navigation serves HTML, and everything a reader changes
// (order, filters, page) is asked for client-side through the URL.
export const dynamic = "force-static";
export const revalidate = 300;

/** The page's metadata, shared by the regional route and the EU shortcut. */
export async function battlesMetadata(
  region: Region,
  locale: string,
): Promise<Metadata> {
  const { t } = await getTranslation("app/battles/page", locale);
  const label = region.toUpperCase();
  return constructMetadata({
    locale,
    title: t("meta-title", { region: label }),
    description: t("meta-description", { region: label }),
    ogTitle: t("og-title"),
    ogSubtitle: t("og-subtitle", { region: label }),
    canonical: ROUTES.BATTLES(region),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  if (!isRegion(region)) return {};
  return battlesMetadata(region, locale);
}

async function BattlesPage({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}) {
  const { locale, region } = await params;
  if (!isRegion(region)) notFound();
  // EU lives at /battles, like every section's shortcut. The redirect belongs
  // to this route and not to the render, which the shortcut also calls.
  if (region === Region.EU) redirect(localizePath(ROUTES.BATTLES(Region.EU), locale));
  return <BattlesView region={region} locale={locale} />;
}

export default withDictionaries("[locale]/(site)/[region]/battles", BattlesPage);
