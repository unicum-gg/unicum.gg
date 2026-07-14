import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hangarBgUrl, type Region } from "@unicum.gg/wargaming";
import type { RatingColor } from "@unicum.gg/core/wargaming/wot/ratings";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;

// Module-level promises so each cold start fetches once and every render
// reuses the resolved buffer instead of re-downloading.
const figtreeRegular = fetch(
  "https://cdn.jsdelivr.net/fontsource/fonts/figtree@latest/latin-400-normal.ttf",
).then((res) => res.arrayBuffer());

const figtreeBold = fetch(
  "https://cdn.jsdelivr.net/fontsource/fonts/figtree@latest/latin-700-normal.ttf",
).then((res) => res.arrayBuffer());

const unicumLogoDataUrl = readFile(
  join(process.cwd(), "src/app/icon.svg"),
  "utf-8",
).then(
  (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
);

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
