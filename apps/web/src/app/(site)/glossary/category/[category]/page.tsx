import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_CATEGORY_DESCRIPTION,
  GLOSSARY_CATEGORY_LABEL,
  isGlossaryCategory,
  type GlossaryCategory,
  type GlossarySummary,
} from "@unicum.gg/shared";
import { GlossaryIndex } from "@/components/glossary";
import { JsonLd } from "@/components/json-ld";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { breadcrumbSchema, definedTermSetSchema } from "@/lib/schema-org";
import { buildSafe, unicum } from "@/services/sdk";

export const dynamic = "force-static";
export const revalidate = 3600;

export function generateStaticParams() {
  return GLOSSARY_CATEGORIES.map((category) => ({ category }));
}

async function loadCategory(
  category: GlossaryCategory,
): Promise<GlossarySummary[]> {
  const { results } = await buildSafe(() => unicum.glossary.list(category), {
    results: [] as GlossarySummary[],
  });
  return results as GlossarySummary[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isGlossaryCategory(category)) return {};
  const label = GLOSSARY_CATEGORY_LABEL[category];
  return constructMetadata({
    title: `${label} terms in World of Tanks`,
    description: GLOSSARY_CATEGORY_DESCRIPTION[category],
    ogTitle: label,
    ogSubtitle: "World of Tanks glossary",
    canonical: ROUTES.GLOSSARY_CATEGORY(category),
  });
}

export default async function GlossaryCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isGlossaryCategory(category)) notFound();

  const terms = await loadCategory(category);
  const label = GLOSSARY_CATEGORY_LABEL[category];
  const description = GLOSSARY_CATEGORY_DESCRIPTION[category];
  const url = `${APP.URL}${ROUTES.GLOSSARY_CATEGORY(category)}`;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd
        data={definedTermSetSchema({
          name: `${label} terms in World of Tanks`,
          description,
          url,
          terms: terms.map((term) => ({
            term: term.term,
            url: `${APP.URL}${ROUTES.GLOSSARY_TERM(term.slug)}`,
          })),
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: APP.URL },
          { name: "Glossary", url: `${APP.URL}${ROUTES.GLOSSARY}` },
          { name: label, url },
        ])}
      />

      <Panel>
        <PanelContent className="px-4 py-12 text-center sm:py-16">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            Glossary &middot; {terms.length} terms
          </div>
          <h1 className="mx-auto max-w-3xl font-heading text-4xl font-bold tracking-tight text-balance md:text-5xl">
            <span className="text-brand">{label}</span> terms
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {description}
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelContent className="px-4 py-8">
          <GlossaryIndex terms={terms} activeCategory={category} />
        </PanelContent>
      </Panel>
    </div>
  );
}
