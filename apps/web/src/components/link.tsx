"use client";

import { useLocale } from "@onruntime/translations/react";
import NextLink from "next/link";
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from "react";
import { useState } from "react";
import { isVehiclePage } from "@/components/tanks/detail/tabs";
import STORAGE from "@/constants/storage";
import { usePathname } from "@/hooks/use-pathname";
import { matchesAnyRoute } from "@/lib/route-match";
import { DEFAULT_LOCALE, isLocale, localizePath } from "@/lib/translations";
import { UNLOCALIZED_PAGES } from "@/proxy-routes.generated";

type NextPrefetch = ComponentProps<typeof NextLink>["prefetch"];

export type LinkProps = Omit<ComponentProps<typeof NextLink>, "locale" | "prefetch"> & {
  /** Point at another language's copy of the same page. Setting it also records
   * the choice, so a bare URL sends the reader back to it afterwards. */
  locale?: string;
  /**
   * `next/link`'s own values, plus `"intent"`: prefetch when the reader shows
   * they might go there (hover, focus or touch) rather than when the link comes
   * near the viewport.
   *
   * **For a list of links nobody is about to click, which on this site means the
   * footer.** Next prefetches a link approaching the viewport, and with no
   * `loading.tsx` anywhere in the tree what it fetches is the destination's
   * ENTIRE payload rather than a shell (its own documented rule). The footer
   * holds seven columns of them, so every page view pulled the whole of
   * `/tanks/all/specifications`, `/tanks/all/economics`, `/players/onslaught`
   * and sixteen others: measured on a tank page, 2.5 MB of the 3.9 MB it
   * transferred, none of it rendered, all of it competing for the bandwidth the
   * page itself needed.
   *
   * It is not `prefetch={false}`, which the docs offer for the same case,
   * because that makes the footer's own links wait for the server on click. On
   * intent the prefetch still happens, just for the one link a reader reached
   * for. Restoring the default once they do is what the `null` here is: it hands
   * the link back to Next's normal static prefetching.
   */
  prefetch?: NextPrefetch | "intent";
};

/**
 * `next/link` with the interface language kept.
 *
 * Every internal path in the codebase is written without a locale (`ROUTES.*`
 * builds `/eu/players/Straik`), because the language is the proxy's business and
 * not the route's. That leaves the anchors: a French reader following a plain
 * `/eu/tanks` would land on the English page, and, worse, a crawler reading the
 * French page would see nothing but links to English ones. Prefixing here means
 * no call site has to carry the locale to build a URL.
 *
 * The client component renders on the server like any other, so the prefix is in
 * the HTML rather than applied after hydration.
 */
export default function Link({
  href,
  locale,
  onClick,
  prefetch,
  scroll,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: LinkProps) {
  const { locale: current } = useLocale();
  const target = isLocale(locale) ? locale : isLocale(current) ? current : DEFAULT_LOCALE;

  /**
   * Whether Next may scroll on this navigation, which between two vehicles it
   * must not.
   *
   * **What it scrolls to is the segment that changed, and on a vehicle's page
   * that segment sits under the hangar.** Both pages share the detail layout,
   * so the only thing React replaces is the tab's own content, which begins
   * about 770 pixels down, below a 600 pixel picture. Next scrolls a changed
   * segment into view whenever it is not already there, so on any window
   * shorter than that the reader clicked a tank and the hangar they were
   * looking at left through the top of the screen. Measured at 768 pixels of
   * viewport: every click from one vehicle to another, and every tab, landed
   * with the picture gone.
   *
   * Kept where it is rather than forced to the top, because the reader is
   * looking at the hero and staying put is the one outcome with no movement in
   * it. Arrivals from anywhere else are untouched, so the catalogue still opens
   * a vehicle at the top of its page.
   */
  const here = usePathname();
  const destination = typeof href === "string" ? href : (href.pathname ?? "");
  const scrolls = scroll ?? (isVehiclePage(here) && isVehiclePage(destination) ? false : undefined);

  // One-way: a reader who has reached for this link once is not un-reached for,
  // and flipping back would throw away a prefetch that has already been paid
  // for.
  const [intended, setIntended] = useState(false);
  const onIntent = prefetch === "intent" ? () => setIntended(true) : undefined;
  const resolvedPrefetch: NextPrefetch =
    prefetch === "intent" ? (intended ? null : false) : prefetch;
  // The caller's own handlers still run: `onMouseEnter` is how a tooltip opens
  // and `onFocus` is how one is reached by keyboard, so swallowing either to
  // read the intent would trade a download for a broken control.
  const intent = {
    onMouseEnter: (event: MouseEvent<HTMLAnchorElement>) => {
      onIntent?.();
      onMouseEnter?.(event);
    },
    // Keyboard and screen-reader readers never hover, so focus is their hover.
    onFocus: (event: FocusEvent<HTMLAnchorElement>) => {
      onIntent?.();
      onFocus?.(event);
    },
    // And a touch has no hover at all: taking it on `touchstart` buys the
    // prefetch the hundred-odd milliseconds before the tap completes.
    onTouchStart: (event: TouchEvent<HTMLAnchorElement>) => {
      onIntent?.();
      onTouchStart?.(event);
    },
  };

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Written on the click rather than by the proxy: the cookie is the reader's
    // chosen default, and merely opening a shared link in another language must
    // not change it (the region cookie follows the same rule).
    if (locale && locale !== current && typeof document !== "undefined") {
      const secure = window.location.protocol === "https:" ? ";Secure" : "";
      document.cookie = `${STORAGE.COOKIES.LOCALE}=${target};path=/;max-age=31536000;SameSite=Lax${secure}`;
    }
    onClick?.(event);
  };

  if (typeof href === "string") {
    // Same-page (`#anchor`, `?tab=x`), external, or another scheme: not ours to
    // rewrite. A relative path resolves against the current URL, which already
    // carries the locale. Nor is a page that lives outside `app/[locale]`
    // (`/docs`): it has one address, and the proxy would only send a prefixed
    // one back here.
    const untouched =
      !href.startsWith("/") ||
      href.startsWith("//") ||
      matchesAnyRoute(href.split(/[?#]/)[0], UNLOCALIZED_PAGES);
    return (
      <NextLink
        href={untouched ? href : localizePath(href, target)}
        onClick={handleClick}
        prefetch={resolvedPrefetch}
        scroll={scrolls}
        {...intent}
        {...props}
      />
    );
  }

  const pathname = href.pathname;
  return (
    <NextLink
      href={
        pathname?.startsWith("/")
          ? { ...href, pathname: localizePath(pathname, target) }
          : href
      }
      onClick={handleClick}
      prefetch={resolvedPrefetch}
      scroll={scrolls}
      {...intent}
      {...props}
    />
  );
}
