"use client";

import { useLocale } from "@onruntime/translations/react";
import NextLink from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import STORAGE from "@/constants/storage";
import { matchesAnyRoute } from "@/lib/route-match";
import { DEFAULT_LOCALE, isLocale, localizePath } from "@/lib/translations";
import { UNLOCALIZED_PAGES } from "@/proxy-routes.generated";

export type LinkProps = Omit<ComponentProps<typeof NextLink>, "locale"> & {
  /** Point at another language's copy of the same page. Setting it also records
   * the choice, so a bare URL sends the reader back to it afterwards. */
  locale?: string;
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
  ...props
}: LinkProps) {
  const { locale: current } = useLocale();
  const target = isLocale(locale) ? locale : isLocale(current) ? current : DEFAULT_LOCALE;

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
      {...props}
    />
  );
}
