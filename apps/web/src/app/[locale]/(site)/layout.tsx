import type { ReactNode } from "react";
import { SiteChrome } from "@/components/site-chrome";

// Every site page renders inside the shared chrome (top bar + nav + footer).
// Standalone sections at the app root (e.g. `/docs`) sit outside this group and
// bring their own layout.
export default async function SiteLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {
  // The chrome carries the glossary anchors, and a tooltip is prose: it has to
  // be the reader's, so the language reaches it from the segment rather than
  // from a request the layout has no business reading.
  const { locale } = await params;
  return <SiteChrome locale={locale}>{children}</SiteChrome>;
}
