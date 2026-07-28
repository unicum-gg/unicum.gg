import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { TopBar } from "@/components/top-bar";
import { Footer } from "@/components/footer";
import { NavDebug } from "@/components/nav-debug";
import { RatingMetricRoot } from "@/components/rating-metric-root";
import { baseOptions } from "@/lib/layout.shared";

// The main site chrome: the funding/online top bar, the fumadocs HomeLayout nav,
// and the footer. Used by the `(site)` layout for every page, and by the root
// `not-found` so the global 404 keeps the nav + footer (the root layout itself
// is chrome-less so `/docs` can be standalone).
export async function SiteChrome({
  children,
}: Readonly<{ children: ReactNode }>) {
  const layoutProps = await baseOptions();
  return (
    <>
      <NavDebug />
      <RatingMetricRoot />
      <TopBar />
      <HomeLayout {...layoutProps}>
        <div id="page-content" className="flex flex-col">
          {children}
        </div>
        <Footer />
      </HomeLayout>
    </>
  );
}
