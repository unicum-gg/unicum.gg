import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { GlossaryAnchorPayload } from "@unicum.gg/shared";
import { GlossaryAnchorProvider } from "@/components/glossary/anchor-context";
import { TopBar } from "@/components/top-bar";
import { Footer } from "@/components/footer";
import { NavDebug } from "@/components/nav-debug";
import { RatingMetricRoot } from "@/components/rating-metric-root";
import { baseOptions } from "@/lib/layout.shared";
import { unicum } from "@/services/sdk";

const NO_ANCHORS: GlossaryAnchorPayload = {
  terms: [],
  bySpecKey: {},
  byLabel: {},
};

// The main site chrome: the funding/online top bar, the fumadocs HomeLayout nav,
// and the footer. Used by the `(site)` layout for every page, and by the root
// `not-found` so the global 404 keeps the nav + footer (the root layout itself
// is chrome-less so `/docs` can be standalone).
export async function SiteChrome({
  children,
}: Readonly<{ children: ReactNode }>) {
  const layoutProps = await baseOptions();
  // Loaded for the whole group rather than per section. It is ~15 KB of JSON
  // (4 KB on the wire) on every page, including the ones that name no term
  // today, and that is the deliberate trade: the anchors are transverse by
  // design, so a table gets its tooltips by someone writing a definition, not
  // by remembering to add a provider above it. `glossary-coverage.ts` prints
  // the payload size so the trade stays visible if it grows.
  //
  // Caught here rather than left to `buildSafe`, which only swallows during
  // `next build` and propagates at runtime by design. This is the layout of
  // every page in the group, so an endpoint hiccup would take the whole site
  // down for a decorative payload: the tooltips are what a failure may cost,
  // and nothing else.
  const anchors = await unicum.glossary
    .anchors()
    .then((payload) => payload as GlossaryAnchorPayload)
    .catch((error: unknown) => {
      console.warn("[glossary] anchors unavailable, tooltips disabled:", error);
      return NO_ANCHORS;
    });
  return (
    <>
      <NavDebug />
      <RatingMetricRoot />
      <TopBar />
      <HomeLayout {...layoutProps}>
        <GlossaryAnchorProvider payload={anchors}>
          <div id="page-content" className="flex flex-col">
            {children}
          </div>
        </GlossaryAnchorProvider>
        <Footer />
      </HomeLayout>
    </>
  );
}
