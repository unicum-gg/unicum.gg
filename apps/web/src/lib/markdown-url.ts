/**
 * A page's Markdown twin. Every page is also served as Markdown by appending
 * `.md` (see `proxy.ts`), with the root at `/index.md` because `/.md` is not a
 * path.
 *
 * One function because three places need the same answer and must not drift:
 * the `rel="alternate"` a page advertises, the links inside a Markdown document,
 * and the entries of a Markdown sitemap.
 */
export function markdownPath(pathname: string): string {
  const clean =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return clean === "" || clean === "/" ? "/index.md" : `${clean}.md`;
}
