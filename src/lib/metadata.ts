import "server-only";
import type { Metadata } from "next";
import { headers } from "next/headers";
import APP from "@/constants/app";

const SITE_URL = APP.URL;
const SITE_NAME = APP.NAME;
const SITE_DESCRIPTION = APP.DESCRIPTION;

export async function constructMetadata({
  title,
  description = SITE_DESCRIPTION,
  ogTitle,
  ogSubtitle,
  ogImage,
  ogType = "website",
  noIndex = false,
}: {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogSubtitle?: string;
  // `false` skips the images field entirely so a page-local
  // `opengraph-image.tsx` (Next convention) is auto-bound instead of being
  // overridden by the dynamic /api/og route.
  ogImage?: string | false;
  ogType?: "website" | "article";
  noIndex?: boolean;
} = {}): Promise<Metadata> {
  const canonical = await generateCanonical();
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
    other: { "google-adsense-account": "ca-pub-3691404603790195" },
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

async function getPathname(): Promise<string> {
  const h = await headers();
  const pathname =
    h.get("x-pathname") ?? h.get("x-invoke-path") ?? "/";
  return (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
}

async function generateCanonical(): Promise<string> {
  const pathname = await getPathname();
  return pathname === "/" ? SITE_URL : `${SITE_URL}${pathname}`;
}
