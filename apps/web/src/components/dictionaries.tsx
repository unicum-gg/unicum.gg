import type { ReactNode } from "react";
import { DictionaryScope } from "@/components/dictionary-scope";
import { getRouteDictionaries } from "@/lib/translations.server";
import type { RouteScope } from "@/locales/generated/scopes";

/**
 * The strings this route reads, resolved on the server and layered over the
 * chrome's (see `DictionaryScope`).
 *
 * `scope` is the route's own folder under `src/app`, which is what
 * `scripts/generate-locale-scopes` keys its lists by, so there is nothing to
 * invent and naming one that does not exist is a compile error.
 */
export async function Dictionaries({
  locale,
  scope,
  children,
}: {
  /** The raw route segment, like everywhere else in this API: anything the
   * proxy could not have produced reads as the default. */
  locale: string;
  scope: RouteScope;
  children: ReactNode;
}) {
  const dictionaries = await getRouteDictionaries(locale, scope);
  return (
    <DictionaryScope dictionaries={dictionaries}>{children}</DictionaryScope>
  );
}

/**
 * A page under its own scope, applied at the export rather than inside the
 * tree.
 *
 * Every page needs one, because the root layout cannot know which page it is
 * rendering: `children` is opaque to it, and reading the path would need
 * `headers()`, which opts the page out of static rendering, which is most of
 * this site. A layout can only ever carry what every page under it shares,
 * and measured, that is not enough: bounding the scope at the deepest layout
 * leaves 66% of the catalogue on every page, against 16% at the page itself,
 * because there are six layouts and a hundred and seven pages.
 *
 * Wrapping at the export keeps the page's own body untouched, which is what
 * makes this safe to apply across all of them: there is no returned tree to
 * restructure, no early `notFound()` to route around, and `generateMetadata`
 * and `generateStaticParams` stay the named exports Next reads them as.
 */
export function withDictionaries<
  P extends { params: Promise<{ locale: string }> },
>(scope: RouteScope, Page: (props: P) => ReactNode | Promise<ReactNode>) {
  return async function ScopedPage(props: P) {
    const { locale } = await props.params;
    return (
      <Dictionaries locale={locale} scope={scope}>
        <Page {...props} />
      </Dictionaries>
    );
  };
}
