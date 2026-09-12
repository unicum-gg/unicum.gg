import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Document } from "@/components/document";
import { source } from "@/lib/docs-source";
import { baseOptions } from "@/lib/layout.shared";
import { constructMetadata } from "@/lib/metadata";
import { DEFAULT_LOCALE } from "@/lib/translations";
import ROUTES from "@/constants/routes";

export function generateMetadata(): Metadata {
  return constructMetadata({
    locale: DEFAULT_LOCALE,
    title: "API Docs",
    description:
      "Interactive reference for the unicum.gg public API: player, clan and tank search, leaderboards and live updates across EU, NA and Asia.",
    canonical: ROUTES.DOCS,
  });
}

/**
 * Standalone docs: its own fumadocs nav (site logo + links from baseOptions) and
 * the endpoint sidebar tree, without the site's top bar / HomeLayout / footer.
 * `/docs` sits outside the `(site)` route group so it opts out of that chrome.
 *
 * It also sits outside `app/[locale]`, so this is a root layout of its own and
 * renders the document. The reference is generated from the OpenAPI document,
 * every word of it written by the endpoints themselves, so there is nothing here
 * a translator would touch and 27 addresses would only invite a crawler to read
 * the same English page 27 times. It still needs the translation provider: the
 * nav it shares with the site is built from components that read the language
 * off the context.
 */
export default async function Layout({ children }: { children: ReactNode }) {
  // Docs nav: just the logo + search + tag-grouped endpoint tree. Drop the site
  // section links (they'd duplicate the tag folders) and the metric/region
  // pickers (no meaning here).
  const base = await baseOptions({ selectors: false, sections: false });
  return (
    <Document locale={DEFAULT_LOCALE}>
      <DocsLayout {...base} tree={source.pageTree}>
      {/* `#page-content` is what the `.md` twin route extracts and converts (see
          `api/md/[...slug]`); `display:contents` keeps it transparent to
          fumadocs' own layout while still exposing the node for extraction. */}
        <div id="page-content" className="contents">
          {children}
        </div>
      </DocsLayout>
    </Document>
  );
}
