/**
 * The creators we partner with and the assets we hand them, keyed by the same
 * slug as their vanity URL (`@unicum.gg/core/partners`), so `/remi` and
 * `/partners/remi` always name the same person.
 *
 * Nothing here is a file. Every asset is rendered on demand by
 * `/api/partners/[slug]/[asset]`, the way the OG cards are, so onboarding a
 * creator is one entry below and a redirect line: no binaries to produce, and a
 * change to the brand reaches every kit at once.
 */

/** The wording baked into a creator's images.
 *
 * The page around them is English like the rest of the site, which is what lets
 * it be translated; the images cannot be, since they are rendered pixels. So the
 * copy that ends up inside them follows the creator's own audience instead,
 * declared per kit. */
export const ASSET_COPY = {
  en: {
    tagline: "World of Tanks stats, tanks and clans",
    kicker: "WORLD OF TANKS STATS",
    kickerYours: "YOUR WORLD OF TANKS STATS",
    scan: "SCAN ME",
  },
  fr: {
    tagline: "Stats, chars et clans World of Tanks",
    kicker: "STATS WORLD OF TANKS",
    kickerYours: "TES STATS WORLD OF TANKS",
    scan: "SCANNE-MOI",
  },
} as const;

export type AssetLocale = keyof typeof ASSET_COPY;

export const PARTNER_ASSETS = {
  overlay: {
    labelKey: "overlay",
    hintKey: "overlay-hint",
    width: 326,
    height: 74,
  },
  "overlay-compact": {
    labelKey: "overlay-compact",
    hintKey: "overlay-compact-hint",
    width: 290,
    height: 70,
  },
  panel: {
    labelKey: "panel",
    hintKey: "panel-hint",
    width: 320,
    height: 160,
  },
  offline: {
    labelKey: "offline",
    hintKey: "offline-hint",
    width: 1920,
    height: 1080,
  },
  "offline-qr": {
    labelKey: "offline-qr",
    hintKey: "offline-qr-hint",
    width: 1920,
    height: 1080,
  },
} as const;

export type PartnerAssetId = keyof typeof PARTNER_ASSETS;

export const PARTNER_ASSET_IDS = Object.keys(PARTNER_ASSETS) as PartnerAssetId[];

export type PartnerKit = { name: string; locale: AssetLocale };

export const PARTNER_KITS: Record<string, PartnerKit> = {
  remi: { name: "Remi_iD", locale: "fr" },
  ophacker: { name: "O_P_Hacker", locale: "en" },
  orzanel: { name: "Orzanel", locale: "en" },
  kajzoo: { name: "kajzoo", locale: "en" },
};

/**
 * Per-em advance width of every glyph a slug or a kicker can hold, in Figtree
 * Bold, measured in a browser at 100px and divided down.
 *
 * It exists because the images have to be sized before they are drawn:
 * `ImageResponse` takes a width, and Satori cannot report back how wide the text
 * it laid out came out. Counting characters is not enough, since `skill4ltu` and
 * `dezgamez` differ by 24px at the same length, so a fixed width either clips a
 * long name or leaves a short one floating in empty space.
 *
 * The sum runs about 3% over a real measurement, because it ignores the kerning
 * pairs the font applies. That is the safe direction: a badge a few pixels wide
 * is invisible, a clipped URL is not.
 */
const GLYPH_EM: Record<string, number> = { " ": 0.278, "'": 0.2378, "-": 0.3331, ".": 0.278, "/": 0.278, "0": 0.5563, "1": 0.5563, "2": 0.5563, "3": 0.5563, "4": 0.5563, "5": 0.5563, "6": 0.5563, "7": 0.5563, "8": 0.5563, "9": 0.5563, "A": 0.7222, "B": 0.7222, "C": 0.7222, "D": 0.7222, "E": 0.667, "F": 0.6109, "G": 0.778, "H": 0.7222, "I": 0.278, "J": 0.5563, "K": 0.7222, "L": 0.6109, "M": 0.8331, "N": 0.7222, "O": 0.778, "P": 0.667, "Q": 0.778, "R": 0.7222, "S": 0.667, "T": 0.6109, "U": 0.7222, "V": 0.667, "W": 0.9439, "X": 0.667, "Y": 0.667, "Z": 0.6109, "_": 0.5563, "a": 0.5563, "b": 0.6109, "c": 0.5563, "d": 0.6109, "e": 0.5563, "f": 0.3331, "g": 0.6109, "h": 0.6109, "i": 0.278, "j": 0.278, "k": 0.5563, "l": 0.278, "m": 0.8892, "n": 0.6109, "o": 0.6109, "p": 0.6109, "q": 0.6109, "r": 0.3892, "s": 0.5563, "t": 0.3331, "u": 0.6109, "v": 0.5563, "w": 0.778, "x": 0.5563, "y": 0.5563, "z": 0.5 };

/** Width in px of `text` at `size`, including the tracking applied to it. */
export function textWidth(text: string, size: number, tracking = 0): number {
  let em = 0;
  for (const ch of text) em += GLYPH_EM[ch] ?? 0.5563;
  return em * size + Math.max(0, text.length - 1) * tracking;
}

/**
 * The size an asset renders at for one creator.
 *
 * The overlays follow their own text, the panel and the offline screens do not:
 * the first is laid over someone's gameplay where every pixel is contested,
 * while a panel has a column width Twitch fixes and an offline screen is a
 * 16:9 frame.
 */
export function assetSize(
  id: PartnerAssetId,
  slug: string,
  locale: AssetLocale,
): { width: number; height: number } {
  const asset = PARTNER_ASSETS[id];
  if (id !== "overlay" && id !== "overlay-compact") {
    return { width: asset.width, height: asset.height };
  }
  const copy = ASSET_COPY[locale];
  const url = `unicum.gg/${slug}`;
  if (id === "overlay") {
    // border-left 3 + padding 16 + logo 30 + gap 12 + content + padding 16
    const content = Math.max(
      textWidth(url, 22, -0.5),
      textWidth(copy.kicker, 10, 1.5),
    );
    return { width: Math.ceil(77 + content), height: asset.height };
  }
  // Compact: no logo, so border-left 3 + padding 16 + content + padding 16
  const content = Math.max(
    textWidth(url, 21, -0.5),
    textWidth(copy.kickerYours, 10, 1.4),
  );
  return { width: Math.ceil(35 + content), height: asset.height };
}
