/**
 * The site's brand colour, in the two forms consumers need: the CSS string for
 * anything that paints (SVG fills, `next/og` cards, which resolve no custom
 * properties) and the integer Discord wants for an embed's accent bar.
 *
 * The web UI itself should keep using the `brand` Tailwind colour (`bg-brand`,
 * `text-brand`), which reads `--brand` in `globals.css`. These constants are for
 * the places a CSS variable cannot reach. `--brand` and `BRAND_COLOR` are the
 * same value written twice because CSS cannot import TypeScript, so a change
 * here has to be mirrored there (and only there).
 */
export const BRAND_COLOR = "#f25322";

/** {@link BRAND_COLOR} as a Discord embed integer. */
export const BRAND_COLOR_INT = parseInt(BRAND_COLOR.slice(1), 16);
