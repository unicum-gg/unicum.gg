import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Document } from "@/components/document";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { DEFAULT_LOCALE, isLocale } from "@/lib/translations";
import { getTranslation } from "@/lib/translations.server";
import { Region } from "@unicum.gg/wargaming";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await getTranslation("app/layout", locale);

  return constructMetadata({
    locale,
    title: t("title"),
    // Site-wide default; per-page generateMetadata overrides this. The
    // description is passed explicitly rather than left to `constructMetadata`'s
    // constant, which is the English one every page still falls back to.
    description: t("description"),
    canonical: ROUTES.HOME(Region.EU),
  });
}

/**
 * Only the default locale is prerendered at build.
 *
 * The other 26 render on demand and are then held by the ISR cache, so a
 * language nobody reads costs nothing: the alternative crosses every locale with
 * every region on every prerendered page, which multiplies both the build and
 * the shared Redis cache by 27 before a single reader has asked for it.
 */
export function generateStaticParams() {
  return [{ locale: DEFAULT_LOCALE }];
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  // The proxy only ever rewrites to a known locale, so this is a net rather
  // than a branch anyone reaches by browsing.
  if (!isLocale(locale)) notFound();

  return <Document locale={locale}>{children}</Document>;
}
