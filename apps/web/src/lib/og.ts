// The OpenGraph cards are English on purpose, like the API reference: they are
// pictures rendered per share, not pages a reader browses in their language.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hangarBgUrl, type Region } from "@unicum.gg/wargaming";
import type { RatingColor } from "@unicum.gg/shared";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;

// Cache-Control for the `/api/og/**` cards: without it Next marks these dynamic
// route handlers `max-age=0` and Cloudflare (whose cache rule respects the
// origin header) leaves them DYNAMIC, re-rendering satori on every hit. Stats
// cards don't need second-fresh, so cache 5 min in the browser, 1 h at the edge
// (`s-maxage`, which CF reads for its Edge TTL), and serve stale for a day while
// revalidating. Purge the CF cache to force an early refresh.
export const OG_CACHE_CONTROL =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

// Module-level promises so each cold start fetches once and every render
// reuses the resolved buffer instead of re-downloading.
const figtreeRegular = fetch(
  "https://cdn.jsdelivr.net/fontsource/fonts/figtree@latest/latin-400-normal.ttf",
).then((res) => res.arrayBuffer());

const figtreeBold = fetch(
  "https://cdn.jsdelivr.net/fontsource/fonts/figtree@latest/latin-700-normal.ttf",
).then((res) => res.arrayBuffer());

// The shell every OG card shares: the same background, the same hairline border
// and the same header height, so the generic card and the per-entity ones read
// as one family rather than as two designs.
export const OG_BG = "#161616";
export const OG_BORDER = "1px solid #3F3F46";
/** The brand header's own height: 20px of padding around a 48px logo, plus its
 * bottom rule. Anything positioned against the header derives from this. */
export const OG_HEADER_HEIGHT = 89;
/** The crest reads in negative, so its body sits a shade above {@link OG_BG}. */
export const OG_CREST_TINT = "#232327";
/** The crest's own height/width, so a caller sizes it by height alone. */
export const CREST_ASPECT = 1511.305 / 1104.586;

// Read once per cold start. Both the wordmark's mark and the background crest
// are derived from this one source, so they can never drift apart.
const unicumIconSvg = readFile(join(process.cwd(), "src/app/icon.svg"), "utf-8");

const svgDataUrl = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const unicumLogoDataUrl = unicumIconSvg.then(svgDataUrl);

// The same mark, flattened into a background texture: the shield body takes a
// tint a shade off the background and the mask strokes drop to the background
// itself, so the drawing reads in negative instead of as a second logo beside
// the wordmark.
const unicumCrestDataUrl = unicumIconSvg.then((svg) =>
  svgDataUrl(
    svg
      .replaceAll('fill="#f25322"', `fill="${OG_BG}"`)
      .replaceAll('fill="#fff"', `fill="${OG_CREST_TINT}"`),
  ),
);

export function loadOgCrest(): Promise<string> {
  return unicumCrestDataUrl;
}

// Satori exposes no way to measure a string, so a card that wants to fit text
// to a width has to estimate it. Per-character widths in em for Figtree bold,
// bucketed by how wide the glyph actually is, then a margin on top so an
// underestimate can never overflow the box. Measured against a rendered card:
// "Glossary" at 108px draws 426px wide and this returns 468px, so the estimate
// sits about a tenth over the truth rather than under it.
const NARROW_GLYPHS = new Set([..."ijltfrI.,;:'!|()[]/ "]);
const WIDE_GLYPHS = new Set([..."mwMW@"]);
const WIDTH_MARGIN = 1.12;

export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const char of text) {
    if (NARROW_GLYPHS.has(char)) em += 0.3;
    else if (WIDE_GLYPHS.has(char)) em += 0.85;
    else if (char >= "A" && char <= "Z") em += 0.62;
    else em += 0.53;
  }
  return em * WIDTH_MARGIN * fontSize;
}

/** The largest of `sizes` that fits `text` on one line, or the smallest. */
export function fitTextSize(
  text: string,
  width: number,
  sizes: readonly number[],
): number {
  return (
    sizes.find((size) => estimateTextWidth(text, size) <= width) ??
    sizes[sizes.length - 1]
  );
}

// The hangar-floor scene WG's tankopedia detail page uses (the JPEG variant,
// since Satori can't decode WebP). Constant across tanks, so we memoize per
// region host and fetch once per cold start. Resolves to `null` on failure so
// the OG still renders.
const hangarBgCache = new Map<Region, Promise<string | null>>();

export function hangarBgDataUrl(region: Region): Promise<string | null> {
  const cached = hangarBgCache.get(region);
  if (cached) return cached;
  const promise = fetch(hangarBgUrl(region, "jpg"))
    .then(async (res) =>
      res.ok
        ? `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`
        : null,
    )
    .catch(() => null);
  hangarBgCache.set(region, promise);
  return promise;
}

// Fetch a remote raster into a data URL Satori can embed. Returns `null` on any
// failure (timeout, 404, G-Core throttle) so callers degrade gracefully.
export async function fetchImageDataUrl(
  url: string,
  mime = "image/png",
): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

export type OgAssets = {
  regular: ArrayBuffer;
  bold: ArrayBuffer;
  logoSrc: string;
};

export async function loadOgAssets(): Promise<OgAssets> {
  const [regular, bold, logoSrc] = await Promise.all([
    figtreeRegular,
    figtreeBold,
    unicumLogoDataUrl,
  ]);
  return { regular, bold, logoSrc };
}

export function ogFonts(assets: OgAssets) {
  return [
    {
      name: "Figtree",
      data: assets.regular,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Figtree",
      data: assets.bold,
      weight: 700 as const,
      style: "normal" as const,
    },
  ];
}

export const intFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
export const ratingFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
export const pctFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

// 9-bucket palette as inline hex. Tailwind class names don't apply inside
// Satori-rendered OG images, so we mirror RATING_COLOR_CLASS as raw hex.
export const RATING_BG: Record<RatingColor, string> = {
  veryBad: "#000000",
  bad: "#CD3333",
  belowAvg: "#D77900",
  average: "#D7B600",
  good: "#6D9521",
  veryGood: "#4C762E",
  super: "#4A92B7",
  excellent: "#83579D",
  top: "#5A3175",
};

export function normalizeTagColor(raw: string): string {
  if (!raw) return "#F5F5F5";
  if (raw.startsWith("#")) return raw;
  if (raw.startsWith("0x")) return `#${raw.slice(2)}`;
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`;
  return "#F5F5F5";
}
