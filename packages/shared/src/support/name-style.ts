// How a supporter's nickname is drawn, wherever it appears on the site. Pure
// and client-safe: the endpoint validates with it, the picker lists from it and
// every nickname reads it back, so the three cannot name different choices.

/** The typeface. `Default` is the site's own, so a style can be colour alone. */
export enum NameFont {
  Default = "default",
  Stencil = "stencil",
  Pixel = "pixel",
  Future = "future",
  Marker = "marker",
  Rounded = "rounded",
  Typewriter = "typewriter",
  Horror = "horror",
  Armour = "armour",
  Comic = "comic",
  Script = "script",
  Glitch = "glitch",
}

/** What is done with the colours. */
export enum NameEffect {
  Solid = "solid",
  Gradient = "gradient",
  Neon = "neon",
  Toon = "toon",
  Pop = "pop",
  /** Glossy, like a sweet: lit from above, with a soft shadow under it. */
  Gummy = "gummy",
  /** A rainbow that ignores the colours picked, and moves where allowed to. */
  Prism = "prism",
}

/**
 * The palette, fixed and drawn from the site's own colours rather than a
 * generic set: the brand orange, the rating scale every table on the site is
 * painted in (red to purple), and the metals the crests are struck in (bronze,
 * silver, gold, the verified blue). A nickname then reads as part of the page
 * rather than pasted onto it.
 */
export enum NameColor {
  Brand = "brand",
  Red = "red",
  Orange = "orange",
  Yellow = "yellow",
  Gold = "gold",
  Bronze = "bronze",
  Olive = "olive",
  Green = "green",
  Steel = "steel",
  Sky = "sky",
  Purple = "purple",
  Silver = "silver",
}

export const NAME_COLOR_HEX: Record<NameColor, string> = {
  [NameColor.Brand]: "#f25322",
  [NameColor.Red]: "#cd3333",
  [NameColor.Orange]: "#d77900",
  [NameColor.Yellow]: "#d7b600",
  [NameColor.Gold]: "#ffba00",
  [NameColor.Bronze]: "#d68c4e",
  [NameColor.Olive]: "#6d9521",
  [NameColor.Green]: "#4c762e",
  [NameColor.Steel]: "#4a92b7",
  [NameColor.Sky]: "#3b9eff",
  [NameColor.Purple]: "#83579d",
  [NameColor.Silver]: "#c4c9d1",
};

/** A nickname style. `color2` is only read by the effects that use two. */
export type NameStyle = {
  font: NameFont;
  effect: NameEffect;
  color: NameColor;
  color2: NameColor;
};

/** Which effects read the second colour, so the picker only offers it there. */
export const NAME_EFFECTS_WITH_TWO_COLORS: ReadonlySet<NameEffect> = new Set([
  NameEffect.Gradient,
  NameEffect.Pop,
]);

/** Which effects read no colour at all. */
export const NAME_EFFECTS_WITHOUT_COLOR: ReadonlySet<NameEffect> = new Set([
  NameEffect.Prism,
]);

export const DEFAULT_NAME_STYLE: NameStyle = {
  font: NameFont.Default,
  effect: NameEffect.Solid,
  color: NameColor.Brand,
  color2: NameColor.Gold,
};

function member<T extends string>(values: Record<string, T>, value: unknown): T | null {
  return (Object.values(values) as unknown[]).includes(value) ? (value as T) : null;
}

/**
 * Read a style from untrusted input (a request body, a cached payload). Null
 * when it names a font, effect or colour that does not exist, so a value the
 * site has since dropped renders as a plain nickname rather than a broken one.
 */
export function parseNameStyle(value: unknown): NameStyle | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const font = member(NameFont, v.font);
  const effect = member(NameEffect, v.effect);
  const color = member(NameColor, v.color);
  const color2 = member(NameColor, v.color2) ?? color;
  if (!font || !effect || !color || !color2) return null;
  return { font, effect, color, color2 };
}
