"use client";

import {
  TranslationContext,
  useTranslationContext,
} from "@onruntime/translations/react";
import { useCallback, useMemo, type ReactNode } from "react";
import type { Dictionaries, Namespace } from "@/locales/generated";

/**
 * One route's own strings, layered over the chrome's.
 *
 * The provider in `components/provider` carries what every page shares, which is
 * 42 namespaces of navigation, footer, search and badges. Everything else
 * belongs to the section that reads it, and arrives here: the loader checks this
 * scope first and delegates upwards, so a tab under a scoped layout reads the
 * chrome, its layout's set and its own without any of the three crossing the
 * wire twice.
 *
 * Composing rather than replacing is the whole trick, and it is why this is ours
 * rather than a second `AppTranslationProvider`: the library's context holds one
 * loader, so a nested provider would hide the chrome from everything below it.
 * Spreading the outer value keeps the locale, the cookie name and `setLocale`
 * exactly as the root provider set them.
 */
export function DictionaryScope({
  dictionaries,
  children,
}: {
  dictionaries: Dictionaries;
  children: ReactNode;
}) {
  const outer = useTranslationContext();
  const load = useCallback(
    (locale: string, namespace: string) =>
      dictionaries[namespace as Namespace] ?? outer.load(locale, namespace),
    [dictionaries, outer],
  );
  const value = useMemo(() => ({ ...outer, load }), [outer, load]);
  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}
