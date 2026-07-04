import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
