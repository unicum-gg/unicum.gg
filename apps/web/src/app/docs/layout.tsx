import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/docs-source";
import { baseOptions } from "@/lib/layout.shared";
import { constructMetadata } from "@/lib/metadata";
import ROUTES from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "API Docs",
    description:
      "Interactive reference for the unicum.gg public API: player, clan and tank search, leaderboards and live updates across EU, NA and Asia.",
    canonical: ROUTES.DOCS,
  });
}

// Standalone docs: its own fumadocs nav (site logo + links from baseOptions) and
// the endpoint sidebar tree, without the site's top bar / HomeLayout / footer —
// `/docs` sits outside the `(site)` route group so it opts out of that chrome.
export default async function Layout({ children }: { children: ReactNode }) {
  // Docs nav: just the logo + search + tag-grouped endpoint tree. Drop the site
  // section links (they'd duplicate the tag folders) and the metric/region
  // pickers (no meaning here).
  const base = await baseOptions({ selectors: false, sections: false });
  return (
    <DocsLayout {...base} tree={source.pageTree}>
      {children}
    </DocsLayout>
  );
}
