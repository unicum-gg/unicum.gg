import type { NextConfig } from "next";

/** What `redirects()` returns, one entry of it. Taken from the config type
 * rather than Next's internal module, which is not a public entry point. */
type Redirect = Awaited<
  ReturnType<NonNullable<NextConfig["redirects"]>>
>[number];

/**
 * Redirects for the tabs and filters that used to be query params and are route
 * segments now (so a render builds one tab instead of all of them, and each is
 * indexable).
 *
 * Only the values that actually became a segment are matched. The first version
 * of these rules captured any value at all (`(?<tab>.+)`) and pasted it on as a
 * segment, which meant every URL the enums had moved on from stopped being a
 * page: `?tab=vehicles` (the clan Tanks section's name until June 2026) landed
 * on `/clans/FAME/vehicles` and 404ed, and so did the values naming a default
 * view (`?tab=overview`, `?tab=overall`, `?tab=specifications`), which have no
 * segment to go to at all. Anything unmatched now falls through to the page it
 * was already asking for, which renders, ignores the stale param, and points
 * its canonical at itself.
 *
 * Next always forwards the request's query to the destination (there is no
 * opt-out, and a trailing `?` does not strip it), so the landing URL keeps a
 * stale param. Harmless for the same reason, and it is also why a value can
 * never be redirected to the bare path: the param would survive the hop and
 * match the rule again, forever.
 */
export function legacyQueryRedirects({
  source,
  keys,
  destination,
  segments,
}: {
  source: string;
  /** The params that addressed a view, usually `tab` and `section`. */
  keys: string[];
  /** Carries `:segment`, e.g. `/:region/clans/:tag/:segment`. */
  destination: string;
  segments: Record<string, string>;
}): Redirect[] {
  const entries = Object.entries(segments);
  // A value that still names its own segment rides a named capture, so the
  // common case is one rule per key rather than one per tab.
  const verbatim = entries.filter(([value, segment]) => value === segment);
  const renamed = entries.filter(([value, segment]) => value !== segment);

  return keys.flatMap((key) => [
    ...(verbatim.length > 0
      ? [
          {
            source,
            has: [
              {
                type: "query" as const,
                key,
                // Next anchors this (`^…$`), so the alternation is exact.
                value: `(?<segment>${verbatim.map(([v]) => v).join("|")})`,
              },
            ],
            destination,
            permanent: true,
          },
        ]
      : []),
    ...renamed.map(([value, segment]) => ({
      source,
      has: [{ type: "query" as const, key, value }],
      destination: destination.replace(":segment", segment),
      permanent: true,
    })),
  ]);
}

/**
 * A tab's legacy query value is the segment it became, so the table is the list
 * of segments a page has, read from the tab definitions rather than copied.
 *
 * Renames are the exception, and are why this is a map rather than a list: the
 * clan Tanks section was labelled Vehicles until June 2026, and `?tab=vehicles`
 * is what a good part of the clan pages are still indexed under.
 */
export function segmentsOf(
  tabs: { segment: string | null }[],
  renamed: Record<string, string> = {},
): Record<string, string> {
  return {
    ...Object.fromEntries(
      tabs.flatMap((t) => (t.segment ? [[t.segment, t.segment]] : [])),
    ),
    ...renamed,
  };
}
