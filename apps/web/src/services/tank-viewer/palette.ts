// The site's own colours, as the renderer needs them.
//
// The floor the vehicle stands on belongs to the page, not to the studio: it is
// the one part of this scene a designer would expect to move when the palette
// moves. So it is read from the palette rather than restated in hex, which is
// also what makes it follow the theme without a second set of values kept in
// step by hand.

/**
 * Resolve CSS custom properties to opaque sRGB hex values.
 *
 * **The colour is painted, not parsed.** A first pass read
 * `getComputedStyle().color` and pulled the numbers out of it, which is wrong
 * the moment a browser answers in anything but `rgb()`: ours returns
 * `color(srgb 0.087 0.087 0.087)` for the page and `oklab(0.99 … / 0.06)` for a
 * border, whose figures are not bytes and whose alpha is not where a naive
 * reader looks. Every one of them would have come out black.
 *
 * So the token is filled into a one-pixel canvas over the page's own colour and
 * the pixel is read back. The browser does the parsing, in whatever syntax it
 * likes, and compositing an alpha over what sits behind it comes free with the
 * fill: a token written as `white / 6%` means that much of it on top of what is
 * behind, and behind the hero there is the page.
 *
 * **Read where the colours are used, not where the document starts.** A token
 * can be redefined for a theme, a section or a container, and the hero is
 * exactly that case: it carries `dark` so its tokens resolve dark whatever the
 * page does. Resolving against `document.body` therefore handed the scene the
 * page's own theme, so in the light theme the floor under a dark studio came
 * back light. Pass the element the colours are for and it resolves the way it
 * does where it is drawn.
 *
 * Returns `null` where there is no document to read, so a caller on the server
 * falls back to its own values rather than throwing.
 */
export function readPalette<T extends string>(
  tokens: Record<T, string>,
  within?: Element | null,
): Record<T, number> | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ink = canvas.getContext("2d", { willReadFrequently: true });
  if (!ink) return null;
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  (within ?? document.body).appendChild(probe);
  try {
    // Through an element rather than off the root, so a token defined for a
    // theme, a section or a container resolves the way it does where it is used.
    const resolved = (value: string) => {
      probe.style.color = "";
      probe.style.color = value;
      return getComputedStyle(probe).color;
    };
    const page = resolved("var(--background)");
    const painted = (name: string) => {
      ink.clearRect(0, 0, 1, 1);
      ink.fillStyle = page;
      ink.fillRect(0, 0, 1, 1);
      ink.fillStyle = resolved(`var(${name})`);
      ink.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0] = ink.getImageData(0, 0, 1, 1).data;
      return (r << 16) | (g << 8) | b;
    };
    const out = {} as Record<T, number>;
    for (const key of Object.keys(tokens) as T[]) out[key] = painted(tokens[key]);
    return out;
  } finally {
    probe.remove();
  }
}
