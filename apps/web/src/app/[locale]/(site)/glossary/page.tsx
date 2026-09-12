import { Interpolate } from "@/components/interpolate";
import type { Metadata } from "next";
import type { GlossarySummary } from "@unicum.gg/shared";
import { GlossaryIndex } from "@/components/glossary";
import { JsonLd } from "@/components/json-ld";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { breadcrumbSchema, definedTermSetSchema } from "@/lib/schema-org";
import { buildSafe, unicum } from "@/services/sdk";

// ISR: the catalogue ships with the build, so the only thing that changes it is
// a deploy. Prerendered here and revalidated on the same cadence as the other
// landings.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await getTranslation("app/glossary/page", locale);

  return constructMetadata({
    locale,
    title: t("title"),
    description: t("description"),
    ogTitle: t("og-title"),
    ogSubtitle: t("og-subtitle"),
    canonical: ROUTES.GLOSSARY,
  });
}

export async function loadGlossary(locale: string): Promise<GlossarySummary[]> {
  const { results } = await buildSafe(() => unicum.glossary.list({ language: locale }), {
    results: [] as GlossarySummary[],
  });
  return results as GlossarySummary[];
}

export default async function GlossaryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { t } = await getTranslation("app/glossary/page", locale);
  const terms = await loadGlossary(locale);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd
        data={definedTermSetSchema({
          name: `${APP.NAME} World of Tanks glossary`,
          description: t("description"),
          url: `${APP.URL}${ROUTES.GLOSSARY}`,
          terms: terms.map((term) => ({
            term: term.term,
            url: `${APP.URL}${ROUTES.GLOSSARY_TERM(term.slug)}`,
          })),
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: APP.URL },
          { name: t("breadcrumb"), url: `${APP.URL}${ROUTES.GLOSSARY}` },
        ])}
      />

      <Panel>
        <PanelContent className="px-4 py-12 text-center sm:py-16">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {t("count", { count: terms.length })}
          </div>
          <h1 className="mx-auto max-w-3xl font-heading text-4xl font-bold tracking-tight text-balance md:text-5xl">
            <Interpolate
              template={t("heading")}
              wrap={{
                accent: (text) => <span className="text-brand">{text}</span>,
              }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("intro")}
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelContent className="px-4 py-8">
          <GlossaryIndex terms={terms} />
        </PanelContent>
      </Panel>
    </div>
  );
}
