import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";
import { CalendarView } from "@/components/calendar";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { withDictionaries } from "@/components/dictionaries";

// ISR like the other landings. Ten minutes: the capture writes once an hour,
// and the countdowns are computed in the browser, so nothing on the page goes
// stale faster than that.
export const dynamic = "force-static";
export const revalidate = 600;

export function generateStaticParams() {
  // EU lives at /calendar (app/(site)/calendar), so only NA and ASIA here.
  return [{ region: Region.NA }, { region: Region.ASIA }];
}

export async function calendarMetadata(region: string, locale: string): Promise<Metadata> {
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  const { t } = await getTranslation("app/calendar/page", locale);
  return constructMetadata({
    locale,
    title: t("title", { region: label }),
    description: t("description", { region: label }),
    ogTitle: t("og-title"),
    ogSubtitle: t("og-subtitle", { region: label }),
    canonical: ROUTES.CALENDAR(region),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  return calendarMetadata(region, locale);
}

async function CalendarPage({
  params,
}: {
  params: Promise<{ region: string; locale: string }>;
}) {
  const { region, locale } = await params;
  if (!isRegion(region)) notFound();
  return <CalendarView locale={locale} region={region} />;
}

export default withDictionaries("[locale]/(site)/[region]/calendar", CalendarPage);
