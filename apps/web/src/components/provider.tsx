"use client";

import { AppTranslationProvider } from "@onruntime/translations/next";
import { RootProvider } from "fumadocs-ui/provider/next";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { CookieConsent } from "@/components/cookie-consent";
import Script from "@/components/script";
import { CookieConsentProvider } from "@/contexts/cookie-consent";
import STORAGE from "@/constants/storage";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/translations";
import type { Dictionaries, Namespace } from "@/locales/generated";
import { swrConfig } from "@/services/swr";

const SearchDialog = dynamic(
  () => import("@/components/search/dialog"),
);

export function Provider({
  children,
  locale,
  dictionaries,
}: {
  children: ReactNode;
  locale: Locale;
  /** The active locale's strings, English merged underneath by the server (see
   * `lib/translations.server`), so the browser holds one dictionary set rather
   * than the locale's plus a fallback copy of every string. */
  dictionaries: Dictionaries;
}) {
  // One-shot cleanup of a pre-migration orphan: the region used to be stored in
  // localStorage under `unicum.region`, then moved to a cookie of the same name
  // without removing the old entry, so it lingers as dead data for returning
  // visitors (nothing reads it). Purge it so the only region store is the cookie.
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE.COOKIES.REGION);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // The provider's loader is a lookup, not a bundler `require`: importing the
  // locale files from a client module would inline every language's every file
  // into the browser bundle.
  // fumadocs draws its own chrome (the search trigger, the theme switcher, the
  // table of contents) and translates it through a flat map whose keys carry
  // their context in parentheses. Ours are slugs, since a key with parentheses
  // and spaces is not a name the locale suite accepts, so the two are paired
  // here rather than in the tree.
  const fuma = dictionaries["components/fumadocs"] as
    | Record<string, string>
    | undefined;
  const fumaTranslations = useMemo(
    () =>
      fuma && {
        "Search(search trigger)": fuma.search,
        "Search(search dialog)": fuma.search,
        "Open Search(search trigger)(aria-label)": fuma["search-open"],
        "Close Search(search dialog)(aria-label)": fuma["search-close"],
        "No results found(search dialog)": fuma["search-empty"],
        "Toggle Theme(theme switcher)(aria-label)": fuma["theme-toggle"],
        "Light(theme switcher)(aria-label)": fuma["theme-light"],
        "Dark(theme switcher)(aria-label)": fuma["theme-dark"],
        "System(theme switcher)(aria-label)": fuma["theme-system"],
        "On this page(table of contents)": fuma.toc,
        "No Headings(table of contents)": fuma["toc-empty"],
        "Open Sidebar(sidebar)(aria-label)": fuma["sidebar-open"],
        "Close Sidebar(sidebar)(aria-label)": fuma["sidebar-close"],
        "Collapse Sidebar(sidebar)(aria-label)": fuma["sidebar-collapse"],
        "Previous Page(pagination)": fuma["page-previous"],
        "Next Page(pagination)": fuma["page-next"],
        "Choose a language(language switcher)": fuma.language,
      },
    [fuma],
  );

  const load = useCallback(
    (_locale: string, namespace: string) => dictionaries[namespace as Namespace],
    [dictionaries],
  );

  return (
    <SWRConfig value={swrConfig}>
      <AppTranslationProvider
        locale={locale}
        locales={LOCALES}
        defaultLocale={DEFAULT_LOCALE}
        localeCookie={STORAGE.COOKIES.LOCALE}
        debug={process.env.NODE_ENV === "development"}
        load={load}
      >
        <RootProvider
          search={{ SearchDialog }}
          i18n={{ locale, translations: fumaTranslations }}
        >
          <CookieConsentProvider>
            {children}
            <CookieConsent />
            <Script />
          </CookieConsentProvider>
        </RootProvider>
      </AppTranslationProvider>
    </SWRConfig>
  );
}
