import type { Metadata } from "next";
import { SupportView } from "@/components/support/support-view";
import ROUTES from "@/constants/routes";
import APP from "@/constants/app";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const { t } = await getTranslation("app/support/page", locale);
  return constructMetadata({
    locale,
    title: t("title", { name: APP.NAME }),
    description: t("description", { name: APP.NAME }),
    ogTitle: t("title", { name: APP.NAME }),
    ogSubtitle: t("og-subtitle"),
    canonical: ROUTES.SUPPORT,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SupportView locale={locale} />;
}

// ISR like the other catalog pages (incl. /coverage, which shares the heavy
// coverage query): the page is prerendered and served instantly, and the slow
// data fetch happens during background revalidation, never on a user request.
// The podium/funding here can lag up to `revalidate`; the top-bar funding bar
// stays live client-side, so real-time freshness is covered there.
export const dynamic = "force-static";
export const revalidate = 600;
