"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_CATEGORY_LABEL,
  glossaryAcronym,
  glossaryLetter,
  type GlossaryCategory,
  type GlossarySummary,
} from "@unicum.gg/shared";
import { Panel, PanelContent } from "@/components/panel";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];

/** A term matches on its name, on any spelling it is known by, and on its
 * definition, so a reader who only remembers what a thing does still finds it. */
function matches(term: GlossarySummary, query: string): boolean {
  if (!query) return true;
  const haystack = [term.term, ...term.aliases, term.short]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function TermCard({ term }: { term: GlossarySummary }) {
  const acronym = glossaryAcronym(term);
  return (
    <Link
      href={ROUTES.GLOSSARY_TERM(term.slug)}
      className="group flex flex-col gap-1 rounded-md border border-fd-border p-4 transition-colors hover:border-fd-primary/40 hover:bg-fd-secondary/30"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-fd-foreground group-hover:text-fd-primary">
          {term.term}
          {acronym ? (
            <span className="ml-1.5 font-normal text-fd-muted-foreground">
              {acronym}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs uppercase tracking-wide text-fd-muted-foreground">
          {GLOSSARY_CATEGORY_LABEL[term.category]}
        </span>
      </div>
      <p className="text-sm text-fd-muted-foreground line-clamp-3">
        {term.short}
      </p>
    </Link>
  );
}

/**
 * The glossary index: every term, grouped by initial.
 *
 * The category filter is a set of links to the section hubs rather than client
 * state, so each section is a page of its own that can be linked to and found,
 * and only the text search filters in place. The whole list is rendered
 * server-side, so the HTML a crawler receives holds every term and every link
 * whatever the reader later types.
 */
export function GlossaryIndex({
  terms,
  activeCategory,
}: {
  terms: GlossarySummary[];
  activeCategory?: GlossaryCategory;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const visible = terms.filter((term) => matches(term, query));
    const byLetter = new Map<string, GlossarySummary[]>();
    for (const term of visible) {
      const letter = glossaryLetter(term.term);
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), term]);
    }
    return LETTERS.map((letter) => ({
      letter,
      terms: byLetter.get(letter) ?? [],
    })).filter((group) => group.terms.length > 0);
  }, [terms, query]);

  const shown = groups.reduce((n, group) => n + group.terms.length, 0);

  return (
    <div className="space-y-6">
      {/* Stacked rather than side by side: thirteen sections plus the search
          field never fit on one line, and a row that scrolls horizontally hides
          the last few sections behind a gesture nobody makes. */}
      <div className="flex flex-col gap-4">
        <div className="relative w-full lg:max-w-sm">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fd-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${terms.length} terms`}
            aria-label="Search the glossary"
            className="pl-9"
          />
        </div>
        <ChipRow className="text-sm max-w-full">
          <Chip active={!activeCategory} asChild>
            <Link href={ROUTES.GLOSSARY}>All</Link>
          </Chip>
          {GLOSSARY_CATEGORIES.map((category) => (
            <Chip key={category} active={activeCategory === category} asChild>
              <Link href={ROUTES.GLOSSARY_CATEGORY(category)}>
                {GLOSSARY_CATEGORY_LABEL[category]}
              </Link>
            </Chip>
          ))}
        </ChipRow>
      </div>

      <nav aria-label="Jump to letter" className="flex flex-wrap gap-1">
        {LETTERS.map((letter) => {
          const has = groups.some((group) => group.letter === letter);
          return has ? (
            <a
              key={letter}
              href={`#${letter.toLowerCase()}`}
              className="rounded px-2 py-1 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-secondary/50"
            >
              {letter}
            </a>
          ) : (
            <span
              key={letter}
              aria-hidden
              className="rounded px-2 py-1 text-sm text-fd-muted-foreground/40"
            >
              {letter}
            </span>
          );
        })}
      </nav>

      {shown === 0 ? (
        <Panel>
          <PanelContent className="px-4 py-12 text-center text-fd-muted-foreground">
            No term matches “{query}”.
          </PanelContent>
        </Panel>
      ) : (
        groups.map((group) => (
          <section
            key={group.letter}
            id={group.letter.toLowerCase()}
            className="scroll-mt-24"
          >
            <h2 className="mb-3 font-heading text-2xl font-bold tracking-tight">
              <span className="text-brand">{group.letter}</span>
            </h2>
            <div
              className={cn(
                "grid gap-3",
                "sm:grid-cols-2 lg:grid-cols-3",
              )}
            >
              {group.terms.map((term) => (
                <TermCard key={term.slug} term={term} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
