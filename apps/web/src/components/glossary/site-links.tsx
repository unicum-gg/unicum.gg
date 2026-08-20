"use client";

import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { GlossaryLink } from "@unicum.gg/shared";
import { glossaryLinkHref, glossaryLinkLabel } from "@/components/glossary/links";
import { useRegion } from "@/hooks/use-region";

/**
 * Where a term leads on the site. Client-side because the destination carries
 * the reader's region, which a region-less static page cannot know at build
 * time: the same entry links to `/na/tanks` for a reader on NA.
 */
export function GlossarySiteLinks({ links }: { links: GlossaryLink[] }) {
  const { region } = useRegion();
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link, index) => (
        <Link
          key={index}
          href={glossaryLinkHref(link, region)}
          className="inline-flex items-center gap-1.5 rounded-md border border-fd-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-fd-secondary/50"
        >
          {glossaryLinkLabel(link)}
          <ArrowUpRightIcon className="size-3.5 text-fd-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}
