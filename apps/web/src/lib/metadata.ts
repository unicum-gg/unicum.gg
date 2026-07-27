import "server-only";
import type { Metadata } from "next";
import APP from "@/constants/app";

const SITE_URL = APP.URL;
const SITE_NAME = APP.NAME;
const SITE_DESCRIPTION = APP.DESCRIPTION;

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
  const formattedTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const resolvedOgImage =
    ogImage === false
      ? null
      : (ogImage ?? buildOgImageUrl(ogTitle, ogSubtitle));

  return {
    title: formattedTitle,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical },
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

function buildCanonical(pathname: string): string {
  const cleaned = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  return cleaned === "/" ? SITE_URL : `${SITE_URL}${cleaned}`;
}
