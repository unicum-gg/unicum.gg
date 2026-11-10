import type { Metadata } from "next";
import { BadgesView } from "@/components/badges/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { Dictionaries } from "@/components/dictionaries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const { t } = await getTranslation("app/badges/page", locale);
  return constructMetadata({
    locale,
    title: t("title", { name: APP.NAME }),
    description: t("description"),
    ogTitle: t("title", { name: APP.NAME }),
    ogSubtitle: t("og-subtitle"),
    canonical: ROUTES.BADGES,
  });
}

// Nothing on this page comes from the database: it describes the rules, which
// change with a deploy and not with the data.
export const dynamic = "force-static";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <Dictionaries locale={locale} scope="[locale]/(site)/badges">
      <BadgesView />
    </Dictionaries>
  );
}
