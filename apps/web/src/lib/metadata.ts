import "server-only";
import type { Metadata } from "next";
import APP from "@/constants/app";
import { markdownPath } from "@/lib/markdown-url";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALES,
  localizePath,
  OG_LOCALE,
} from "@/lib/translations";

const SITE_URL = APP.URL;
const SITE_NAME = APP.NAME;
const SITE_DESCRIPTION = APP.DESCRIPTION;

const TITLE_SUFFIX = ` | ${SITE_NAME}`;

/**
 * How every page's `<title>` is built, from its own title and the site name.
 *
 * The first letter is raised, which is not cosmetic once the site is written in
 * 36 languages: a title is a sentence with a value in it (`{tank} World of Tanks
 * stats`), and a language that puts the value later starts the sentence on the
 * word that followed it. The IS-7's French title opened on "statistiques".
 * Raised with the reader's own locale, because Turkish does not agree with the
 * rest on what the capital of `i` is, and left alone when the title opens on the
 * site's own lowercase name.
 */
export function formatTitle(title?: string, locale?: string): string {
  if (!title) return SITE_NAME;
  const opening = title.startsWith(SITE_NAME)
    ? title
    : title.charAt(0).toLocaleUpperCase(locale) + title.slice(1);
  return `${opening}${TITLE_SUFFIX}`;
}

/**
 * The inverse: a page's own title, given the rendered `<title>`. Lives here so
 * it cannot drift from `formatTitle`. Used when reading titles back off the
 * pages (the sitemap's Markdown rendering), where the site name is already the
 * document's heading and would only repeat on every line.
 */
export function stripSiteName(documentTitle: string): string {
  return documentTitle.endsWith(TITLE_SUFFIX)
    ? documentTitle.slice(0, -TITLE_SUFFIX.length)
    : documentTitle;
}

export function constructMetadata({
  title,
  description = SITE_DESCRIPTION,
  ogTitle,
  ogSubtitle,
  ogImage,
  ogType = "website",
  noIndex = false,
  canonical: explicitCanonical,
  locale,
}: {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogSubtitle?: string;
  // A stable `/api/og/...` route URL for the page's card, or `false` to skip the
  // images field entirely (a listing/index page with no per-entity card).
  ogImage?: string | false;
  ogType?: "website" | "article";
  noIndex?: boolean;
  // The page's own absolute path (e.g. "/eu/players/Straik", usually a
  // `ROUTES.X(...)`). Required and never auto-derived: a static (ISR) page is
  // rendered without a request, so there is no path to read — the old
  // `headers()` fallback silently returned the site root for every static page
  // (and reading `headers()` also opts a page out of static rendering).
  //
  // Written WITHOUT a language prefix, always: the prefix is added here, and the
  // same bare path is what every `hreflang` alternate is built from.
  canonical: string;
  // The page's own language, from its route params, for the same reason the
  // canonical is explicit. Getting this wrong is not cosmetic: a French page
  // declaring the English URL as its canonical asks Google to drop it.
  //
  // Taken as the raw segment rather than a `Locale`, so a page hands over what
  // Next gave it and nothing has to validate a value the proxy already
  // constrained. Anything unknown reads as the default, which is what the route
  // would have served anyway.
  locale: string;
}): Metadata {
  const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const path = cleanPathname(explicitCanonical);
  const canonical = buildCanonical(localizePath(path, resolved));
  const formattedTitle = formatTitle(title, resolved);
  // Advertise the page's Markdown twin. Without it the `.md` documents are only
  // reachable through `llms.txt` and the Markdown sitemap: an agent landing on
  // the HTML page has no way to learn that a Markdown rendering exists.
  const markdown = markdownPath(localizePath(path, resolved));
  const resolvedOgImage =
    ogImage === false
      ? null
      : (ogImage ?? buildOgImageUrl(ogTitle, ogSubtitle));

  return {
    title: formattedTitle,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical,
      languages: alternateLanguages(path),
      types: { "text/markdown": markdown },
    },
    openGraph: {
      type: ogType,
      locale: OG_LOCALE[resolved],
      url: canonical,
      title: formattedTitle,
      description,
      siteName: SITE_NAME,
      ...(resolvedOgImage && {
        images: [
          {
            url: resolvedOgImage,
            width: 1200,
            height: 630,
            alt: title ?? SITE_NAME,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: formattedTitle,
      description,
      ...(resolvedOgImage && { images: [resolvedOgImage] }),
    },
    icons: { icon: "/icon.svg" },
    ...(noIndex && { robots: { index: false, follow: false } }),
  };
}

/**
 * Every language this page exists in, keyed by its `hreflang`.
 *
 * Emitted on every page, including the entity pages: it is the only signal that
 * tells a crawler the other versions exist, and it is what keeps them from being
 * read as duplicates of each other. The sitemap deliberately does NOT mirror
 * this for the entity streams (millions of players, clans and tanks), where 36
 * copies of every URL would be a crawl budget spent on nothing.
 */
function alternateLanguages(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    languages[locale] = buildCanonical(localizePath(path, locale));
  }
  // The version to serve a reader whose language we do not publish.
  languages["x-default"] = buildCanonical(localizePath(path, DEFAULT_LOCALE));
  return languages;
}

function buildOgImageUrl(title?: string, subtitle?: string): string {
  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (subtitle) params.set("subtitle", subtitle);
  const qs = params.toString();
  return qs ? `/api/og?${qs}` : "/api/og";
}

/** The page's own path: no query string, no trailing slash. */
function cleanPathname(pathname: string): string {
  return (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
}

function buildCanonical(pathname: string): string {
  const cleaned = cleanPathname(pathname);
  return cleaned === "/" ? SITE_URL : `${SITE_URL}${cleaned}`;
}
