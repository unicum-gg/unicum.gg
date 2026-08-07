/**
 * Does a pathname match an app-router path pattern? Understands the three
 * dynamic segment kinds: `[slug]` (exactly one), `[...rest]` (one or more) and
 * `[[...rest]]` (zero or more).
 *
 * Only used by `proxy.ts`, against the generated page-route lists, to tell a URL
 * the app can serve from one it cannot. It answers "is there a route", never
 * "which route", so it needs no precedence rules.
 */
function matchesPattern(segments: readonly string[], pattern: string): boolean {
  const parts = pattern.split("/").filter(Boolean);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // A catch-all is necessarily the last segment: it swallows the rest.
    if (part.startsWith("[[...")) return true;
    if (part.startsWith("[...")) return segments.length > i;
    if (segments[i] === undefined) return false;
    if (part.startsWith("[")) continue;
    if (part !== segments[i]) return false;
  }
  return segments.length === parts.length;
}

/** Whether any of `patterns` can serve `pathname`. */
export function matchesAnyRoute(
  pathname: string,
  patterns: readonly string[],
): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return patterns.some((pattern) => matchesPattern(segments, pattern));
}
