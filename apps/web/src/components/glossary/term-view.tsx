import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import {
  GLOSSARY_CATEGORY_LABEL,
  glossaryAcronym,
  type GlossaryTermDetail,
} from "@unicum.gg/shared";
import { GlossaryBody } from "@/components/glossary/body";
import { GlossarySiteLinks } from "@/components/glossary/site-links";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import ROUTES from "@/constants/routes";

/**
 * One term's page: the definition first, then the entry, then the ways out
 * (related terms and the pages of the site the term is actually about).
 *
 * The page is as wide as every other one on the site, so the panel rules line
 * up with the navbar instead of drawing a narrower frame of their own. Reading
 * width is held on the prose itself, which is where it belongs.
 */
export function GlossaryTermView({ term }: { term: GlossaryTermDetail }) {
  // The initialism sits next to the name rather than replacing it: the entry is
  // "Damage per minute", and the reader arrived looking for "DPM".
  const acronym = glossaryAcronym(term);
  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="max-w-3xl px-4 py-8 sm:py-12">
          <nav className="mb-4 flex items-center gap-2 text-sm text-fd-muted-foreground">
            <Link href={ROUTES.GLOSSARY} className="hover:text-fd-foreground">
              Glossary
            </Link>
            <span aria-hidden>/</span>
            <Link
              href={ROUTES.GLOSSARY_CATEGORY(term.category)}
              className="hover:text-fd-foreground"
            >
              {GLOSSARY_CATEGORY_LABEL[term.category]}
            </Link>
          </nav>

          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            {term.term}
            {acronym ? (
              <span className="ml-3 align-middle text-2xl font-medium text-fd-muted-foreground md:text-3xl">
                {acronym}
              </span>
            ) : null}
          </h1>
          <p className="mt-4 text-lg text-fd-muted-foreground">{term.short}</p>

          {term.aliases.length ? (
            <p className="mt-4 text-sm text-fd-muted-foreground">
              Also known as{" "}
              <span className="text-fd-foreground">
                {term.aliases.join(", ")}
              </span>
              .
            </p>
          ) : null}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelContent className="max-w-3xl px-4 py-8">
          <GlossaryBody body={term.body} />
        </PanelContent>
      </Panel>

      {term.links.length ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>See it on the site</PanelTitle>
            </PanelHeader>
            <PanelContent className="px-4 pb-6">
              <GlossarySiteLinks links={term.links} />
            </PanelContent>
          </Panel>
        </>
      ) : null}

      {term.related.length ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>Related terms</PanelTitle>
            </PanelHeader>
            <PanelContent className="px-4 pb-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {term.related.map((related) => (
                  <Link
                    key={related.slug}
                    href={ROUTES.GLOSSARY_TERM(related.slug)}
                    className="group flex flex-col gap-1 rounded-md border border-fd-border p-4 transition-colors hover:border-fd-primary/40 hover:bg-fd-secondary/30"
                  >
                    <span className="font-medium text-fd-foreground group-hover:text-fd-primary">
                      {related.term}
                    </span>
                    <span className="text-sm text-fd-muted-foreground line-clamp-2">
                      {related.short}
                    </span>
                  </Link>
                ))}
              </div>
            </PanelContent>
          </Panel>
        </>
      ) : null}

      <PanelSeparator />

      <Panel>
        <PanelContent className="px-4 py-6">
          {/* `flex w-fit`, not `inline-flex`: an inline box sits on the text
              baseline, which leaves a few pixels of descender space under it
              and pushes the row off-centre inside its padding. */}
          <Link
            href={ROUTES.GLOSSARY}
            className="flex w-fit items-center gap-2 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Every World of Tanks term
          </Link>
        </PanelContent>
      </Panel>
    </div>
  );
}
