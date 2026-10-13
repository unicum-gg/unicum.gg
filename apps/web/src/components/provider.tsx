"use client";

import { AppTranslationProvider } from "@onruntime/translations/next";
import { RootProvider } from "fumadocs-ui/provider/next";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { CookieConsent } from "@/components/cookie-consent";
import { TooltipProvider } from "@/components/ui/tooltip";
import Script from "@/components/script";
import { CookieConsentProvider } from "@/contexts/cookie-consent";
import STORAGE from "@/constants/storage";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/translations";
import type { Dictionaries, Namespace } from "@/locales/generated";
import { swrConfig } from "@/services/swr";

// **`ssr: false` is the half that was missing.** A lazily imported component
// that still server-renders has to be downloaded to hydrate, so the dialog sat
// in the initial graph of every page: the fumadocs search chrome it is built
// from brings a content-processing runtime with it, measured at 180 KB parsed,
// on a dialog nobody has opened. There is nothing to server-render either way,
// since it is a modal that renders only once it is opened.
const SearchDialog = dynamic(() => import("@/components/search/dialog"), {
  ssr: false,
});

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
        {/* One provider for the whole app, which is what lets `Hint` be a
            leaf anywhere: Radix refuses a tooltip with no provider above it,
            and the alternative (every hint carrying its own) would give a
            table of fifty rows fifty of them and lose the shared delay, where
            moving from one cell to the next re-waits. The local providers that
            remain are the ones tuning their own delay, and they nest
            harmlessly.

            **It sits above `RootProvider`, and that is load-bearing.** fumadocs
            mounts the search dialog itself, as a SIBLING of the children it was
            handed, so the dialog's tree never passes through anything placed
            underneath it. Nested inside, every hint the dialog draws threw
            "`Tooltip` must be used within `TooltipProvider`" the moment a
            reader opened it, while the rest of the site was fine. */}
        <TooltipProvider delayDuration={150}>
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
        </TooltipProvider>
      </AppTranslationProvider>
    </SWRConfig>
  );
}
