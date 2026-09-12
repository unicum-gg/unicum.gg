import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
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
import { getTranslation } from "@/lib/translations.server";
import { breadcrumbSchema, definedTermSchema } from "@/lib/schema-org";
import { buildSafe, unicum } from "@/services/sdk";
import { DEFAULT_LOCALE } from "@/lib/translations";

// ISR, and every term is prerendered: the catalogue is a few hundred entries
// that only change on a deploy, so there is nothing to gain from generating
// them lazily and a crawl to lose.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateStaticParams() {
  // The slugs, which are the same in every language: a slug is the entry's
  // filename and a URL must not move when a page is translated.
  const { results } = await buildSafe(() => unicum.glossary.list({ language: DEFAULT_LOCALE }), {
    results: [] as GlossarySummary[],
  });
  return (results as GlossarySummary[]).map((term) => ({ slug: term.slug }));
}

async function loadTerm(
  slug: string,
  locale: string,
): Promise<GlossaryTermDetail | null> {
  // `buildSafe` on the outside for the same reason the other loaders have it:
  // during `next build` a failure of the in-process handler must not take the
  // whole build down. The page 404s for one revalidation window and heals.
  return buildSafe<GlossaryTermDetail | null>(async () => {
    try {
      return (await unicum.glossary(slug).detail(locale)) as GlossaryTermDetail;
    } catch (error) {
      if (error instanceof UnicumError && error.status === 404) return null;
      throw error;
    }
  }, null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const term = await loadTerm(slug, locale).catch(() => null);
  if (!term) return {};
  // Both forms in the title: half the readers search the initialism and the
  // other half the words, and a page that only carries one loses the other.
  const acronym = glossaryAcronym(term);
  const name = acronym ? `${term.term} (${acronym})` : term.term;
  const { t } = await getTranslation("app/glossary/term/page", locale);
  const { t: tCategories } = await getTranslation(
    "components/glossary/index",
    locale,
  );
  return constructMetadata({
    locale,
    // The question the page answers, in the words it is asked in. The term
    // itself is not translated: the entries are English and a reader arrived
    // looking for the English word.
    title: t("title", { term: name }),
    description: term.short,
    ogTitle: term.term,
    ogSubtitle: tCategories(`categories.${term.category}`),
    canonical: ROUTES.GLOSSARY_TERM(term.slug),
  });
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const { t: tLabel } = await getTranslation("components/labels", locale);
  const term = await loadTerm(slug, locale);
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
            name: tLabel(`glossary-categories.${term.category}`),
            url: `${APP.URL}${ROUTES.GLOSSARY_CATEGORY(term.category)}`,
          },
          { name: term.term, url },
        ])}
      />
      <GlossaryTermView term={term} locale={locale} />
    </>
  );
}
