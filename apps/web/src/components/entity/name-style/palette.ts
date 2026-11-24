// One picked colour, opened out into the shades the effects are drawn with.
//
// Measured off Discord's own nickname styles, which derive every shade from the
// single colour a member picks: a lighter and a near-white tint for highlights,
// a dark and a near-black shade for outlines and shadows, and a saturated
// variant for the neon tube. Lightness ratios below were read off three of
// their palettes (violet, pink, green) and agree across all three.

type Hsl = { h: number; s: number; l: number };

function toHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h =
    max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

function css({ h, s, l }: Hsl): string {
  return `hsl(${h.toFixed(1)} ${Math.min(100, s).toFixed(1)}% ${Math.max(0, Math.min(100, l)).toFixed(1)}%)`;
}

export type NamePalette = {
  main: string;
  light1: string;
  light2: string;
  dark1: string;
  dark2: string;
  toon: string;
  neon: string;
};

export function namePalette(hex: string): NamePalette {
  const c = toHsl(hex);
  const up = (k: number) => ({ ...c, l: c.l + (100 - c.l) * k });
  const down = (k: number) => ({ ...c, l: c.l * k });
  return {
    main: hex,
    light1: css(up(0.3)),
    light2: css(up(0.72)),
    dark1: css(down(0.6)),
    dark2: css(down(0.2)),
    toon: css(down(0.4)),
    neon: css({ h: c.h, s: 100, l: Math.min(60, Math.max(52, c.l)) }),
  };
}
