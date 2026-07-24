import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { TopBar } from "@/components/top-bar";
import { Footer } from "@/components/footer";
import { NavDebug } from "@/components/nav-debug";
import { RatingMetricRoot } from "@/components/rating-metric-root";
import { baseOptions } from "@/lib/layout.shared";

// The main site chrome: the funding/online top bar, the fumadocs HomeLayout nav,
// and the footer. Wraps every page except the standalone sections at the app
// root (e.g. `/docs`), which bring their own layout.
export default async function SiteLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const layoutProps = await baseOptions();
  return (
    <>
      <NavDebug />
      <RatingMetricRoot />
      <TopBar />
      <HomeLayout {...layoutProps}>
        <div id="page-content" className="flex flex-1 flex-col">
          {children}
        </div>
        <Footer />
      </HomeLayout>
    </>
  );
}
