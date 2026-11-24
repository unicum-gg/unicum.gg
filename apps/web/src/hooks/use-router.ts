"use client";

import { useLocale } from "@onruntime/translations/react";
import { useRouter as useNextRouter } from "next/navigation";
import { useMemo } from "react";
import {
  mayScrollTo,
  openingVehicle,
} from "@/components/tanks/detail/arrival";
import { usePathname } from "@/hooks/use-pathname";
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
 *
 * It also carries the second thing an anchor carries, where a vehicle's page
 * opens (`@/components/tanks/detail/arrival`): three surfaces reach one by
 * pushing rather than by a link (the search dialog, the hero's own vehicle
 * picker and a comparison dropping to its last column), and a rule the anchors
 * alone read would have been a rule those three quietly did without.
 */
export function useRouter(): NextRouter {
  const router = useNextRouter();
  const { locale } = useLocale();
  const here = usePathname();
  const target = isLocale(locale) ? locale : DEFAULT_LOCALE;

  return useMemo(() => {
    const localize = (href: string) =>
      href.startsWith("/") && !href.startsWith("//")
        ? localizePath(href, target)
        : href;
    // A push is the navigation itself, so this is the moment an anchor says it
    // from `onNavigate`. A caller that has named a scroll of its own keeps it.
    const going = (
      href: string,
      options: Parameters<NextRouter["push"]>[1],
    ) => {
      openingVehicle(here, href);
      return { ...options, scroll: options?.scroll ?? mayScrollTo(href) };
    };
    return {
      ...router,
      push: (href, options) => router.push(localize(href), going(href, options)),
      replace: (href, options) =>
        router.replace(localize(href), going(href, options)),
      prefetch: (href, options) => router.prefetch(localize(href), options),
    } satisfies NextRouter;
  }, [router, target, here]);
}
