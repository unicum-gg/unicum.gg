import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  GLOSSARY_CATEGORY_LABEL,
  glossaryAcronym,
  type GlossarySummary,
  type GlossaryTermDetail,
} from "@unicum.gg/shared";
import { UnicumError } from "@unicum.gg/sdk";
import { GlossaryTermView } from "@/components/glossary/term-view";
import { JsonLd } from "@/components/json-ld";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { breadcrumbSchema, definedTermSchema } from "@/lib/schema-org";
import { buildSafe, unicum } from "@/services/sdk";

// ISR, and every term is prerendered: the catalogue is a few hundred entries
// that only change on a deploy, so there is nothing to gain from generating
// them lazily and a crawl to lose.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateStaticParams() {
  const { results } = await buildSafe(() => unicum.glossary.list(), {
    results: [] as GlossarySummary[],
  });
  return (results as GlossarySummary[]).map((term) => ({ slug: term.slug }));
}

async function loadTerm(slug: string): Promise<GlossaryTermDetail | null> {
  // `buildSafe` on the outside for the same reason the other loaders have it:
  // during `next build` a failure of the in-process handler must not take the
  // whole build down. The page 404s for one revalidation window and heals.
  return buildSafe<GlossaryTermDetail | null>(async () => {
    try {
      return (await unicum.glossary(slug).detail()) as GlossaryTermDetail;
    } catch (error) {
      if (error instanceof UnicumError && error.status === 404) return null;
      throw error;
    }
  }, null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const term = await loadTerm(slug).catch(() => null);
  if (!term) return {};
  // Both forms in the title: half the readers search the initialism and the
  // other half the words, and a page that only carries one loses the other.
  const acronym = glossaryAcronym(term);
  const name = acronym ? `${term.term} (${acronym})` : term.term;
  return constructMetadata({
    // The question the page answers, in the words it is asked in.
    title: `${name} in World of Tanks, explained`,
    description: term.short,
    ogTitle: term.term,
    ogSubtitle: GLOSSARY_CATEGORY_LABEL[term.category],
    canonical: ROUTES.GLOSSARY_TERM(term.slug),
  });
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const term = await loadTerm(slug);
  if (!term) notFound();

  const url = `${APP.URL}${ROUTES.GLOSSARY_TERM(term.slug)}`;
  return (
    <>
      <JsonLd
        data={definedTermSchema({
          term: term.term,
          slug: term.slug,
          description: term.short,
          url,
          categoryUrl: `${APP.URL}${ROUTES.GLOSSARY_CATEGORY(term.category)}`,
          setUrl: `${APP.URL}${ROUTES.GLOSSARY}`,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: APP.URL },
          { name: "Glossary", url: `${APP.URL}${ROUTES.GLOSSARY}` },
          {
            name: GLOSSARY_CATEGORY_LABEL[term.category],
            url: `${APP.URL}${ROUTES.GLOSSARY_CATEGORY(term.category)}`,
          },
          { name: term.term, url },
        ])}
      />
      <GlossaryTermView term={term} />
    </>
  );
}
