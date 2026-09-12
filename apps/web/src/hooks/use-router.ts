"use client";

import { useLocale } from "@onruntime/translations/react";
import { useRouter as useNextRouter } from "next/navigation";
import { useMemo } from "react";
import { DEFAULT_LOCALE, isLocale, localizePath } from "@/lib/translations";

type NextRouter = ReturnType<typeof useNextRouter>;

/**
 * `next/navigation`'s router with the interface language kept, the way
 * `@/components/link` keeps it for anchors.
 *
 * Pushing a bare path would leave the proxy to guess the language back from a
 * cookie the reader may never have set, so a French reader picking a region
 * would land in English. Same rule as the anchors: an absolute internal path is
 * prefixed, everything else (`refresh`, `back`, an external URL) is the router's
 * own behaviour, untouched.
 */
export function useRouter(): NextRouter {
  const router = useNextRouter();
  const { locale } = useLocale();
  const target = isLocale(locale) ? locale : DEFAULT_LOCALE;

  return useMemo(() => {
    const localize = (href: string) =>
      href.startsWith("/") && !href.startsWith("//")
        ? localizePath(href, target)
        : href;
    return {
      ...router,
      push: (href, options) => router.push(localize(href), options),
      replace: (href, options) => router.replace(localize(href), options),
      prefetch: (href, options) => router.prefetch(localize(href), options),
    } satisfies NextRouter;
  }, [router, target]);
}
