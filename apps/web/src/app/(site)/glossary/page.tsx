import type { Metadata } from "next";
import type { GlossarySummary } from "@unicum.gg/shared";
import { GlossaryIndex } from "@/components/glossary";
import { JsonLd } from "@/components/json-ld";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { breadcrumbSchema, definedTermSetSchema } from "@/lib/schema-org";
import { buildSafe, unicum } from "@/services/sdk";

// ISR: the catalogue ships with the build, so the only thing that changes it is
// a deploy. Prerendered here and revalidated on the same cadence as the other
// landings.
export const dynamic = "force-static";
export const revalidate = 3600;

const TITLE = "World of Tanks glossary";
const DESCRIPTION =
  "Every World of Tanks term explained: game mechanics, vehicle statistics, battle formats, rating systems like WN8 and the slang players actually use. Search it, or read a section at a time.";

export function generateMetadata(): Metadata {
  return constructMetadata({
    title: TITLE,
    description: DESCRIPTION,
    ogTitle: "Glossary",
    ogSubtitle: "Every World of Tanks term, explained",
    canonical: ROUTES.GLOSSARY,
  });
}

export async function loadGlossary(): Promise<GlossarySummary[]> {
  const { results } = await buildSafe(() => unicum.glossary.list(), {
    results: [] as GlossarySummary[],
  });
  return results as GlossarySummary[];
}

export default async function GlossaryPage() {
  const terms = await loadGlossary();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd
        data={definedTermSetSchema({
          name: `${APP.NAME} World of Tanks glossary`,
          description: DESCRIPTION,
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
          { name: "Glossary", url: `${APP.URL}${ROUTES.GLOSSARY}` },
        ])}
      />

      <Panel>
        <PanelContent className="px-4 py-12 text-center sm:py-16">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {terms.length} terms
          </div>
          <h1 className="mx-auto max-w-3xl font-heading text-4xl font-bold tracking-tight text-balance md:text-5xl">
            The World of Tanks <span className="text-brand">glossary</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            What every number on a tank means, how spotting and armor actually
            work, what the ratings measure, and the words the game never
            explains.
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
