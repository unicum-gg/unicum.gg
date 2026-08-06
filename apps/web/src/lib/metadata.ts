import "server-only";
import type { Metadata } from "next";
import APP from "@/constants/app";
import { markdownPath } from "@/lib/markdown-url";

const SITE_URL = APP.URL;
const SITE_NAME = APP.NAME;
const SITE_DESCRIPTION = APP.DESCRIPTION;

const TITLE_SUFFIX = ` | ${SITE_NAME}`;

/** How every page's `<title>` is built, from its own title and the site name. */
export function formatTitle(title?: string): string {
  return title ? `${title}${TITLE_SUFFIX}` : SITE_NAME;
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
  canonical: string;
}): Metadata {
  const canonical = buildCanonical(explicitCanonical);
  const formattedTitle = formatTitle(title);
  // Advertise the page's Markdown twin. Without it the `.md` documents are only
  // reachable through `llms.txt` and the Markdown sitemap: an agent landing on
  // the HTML page has no way to learn that a Markdown rendering exists.
  const markdown = markdownPath(cleanPathname(explicitCanonical));
  const resolvedOgImage =
    ogImage === false
      ? null
      : (ogImage ?? buildOgImageUrl(ogTitle, ogSubtitle));

  return {
    title: formattedTitle,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical, types: { "text/markdown": markdown } },
    openGraph: {
      type: ogType,
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
