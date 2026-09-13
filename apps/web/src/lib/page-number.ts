/**
 * The page a `/page/<n>` segment or a `?page=` value names, or null when it
 * names none.
 *
 * The first page is one of the nulls, deliberately: it is the section's own bare
 * URL, and both `/page/1` and `?page=1` are redirected onto it rather than
 * letting one page be reachable three ways. So is anything that is not a plain
 * positive integer, since `?page=02` and `?page=2e0` would otherwise be two more
 * addresses for a page that already has one, and a crawler will try them.
 *
 * Its own module because `proxy.ts` and the routes it rewrites onto both read
 * it, and the guards beside it are server-only.
 */
export function parsePageNumber(raw: string | null | undefined): number | null {
  if (!raw || !/^[1-9][0-9]*$/.test(raw)) return null;
  const page = Number(raw);
  return page > 1 && Number.isSafeInteger(page) ? page : null;
}
