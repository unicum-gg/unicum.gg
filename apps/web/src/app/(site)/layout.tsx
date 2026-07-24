import type { ReactNode } from "react";
import { SiteChrome } from "@/components/site-chrome";

// Every site page renders inside the shared chrome (top bar + nav + footer).
// Standalone sections at the app root (e.g. `/docs`) sit outside this group and
// bring their own layout.
export default function SiteLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <SiteChrome>{children}</SiteChrome>;
}
