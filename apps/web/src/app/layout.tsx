import type { ReactNode } from "react";

/**
 * A pass-through, deliberately.
 *
 * The document itself (`<html lang>`, the fonts, the providers) lives in
 * `[locale]/layout.tsx`, because the language is a route segment and a parent
 * layout cannot read its child's params. Reading it from the request headers
 * instead would opt every page out of static rendering, which is most of this
 * site. Everything that is not a page (the sitemaps, `robots.txt`, `llms.txt`,
 * the API) sits beside `[locale]` and needs no document at all.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
