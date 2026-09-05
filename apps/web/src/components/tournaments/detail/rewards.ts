import type { PlaceSpan } from "./placements";
import type { TournamentPrizeTier } from "./record";

/**
 * What a team took home, matched from the organiser's own reward table.
 *
 * The bands are headings a human typed ("1st place:", "3rd-4th place:",
 * "9th-16th place:"), so the range is read out of the numbers in the text
 * rather than from a field, because there is no field: `order` numbers the
 * bands for display and repeats, so it identifies nothing.
 */
export type PrizeBand = { from: number; to: number; tier: TournamentPrizeTier };

function bandOf(tier: TournamentPrizeTier): PrizeBand | null {
  const numbers = tier.title.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) return null;
  const from = numbers[0]!;
  const to = numbers.length > 1 ? numbers[1]! : from;
  return { from: Math.min(from, to), to: Math.max(from, to), tier };
}

export function prizeBands(tiers: TournamentPrizeTier[]): PrizeBand[] {
  return tiers
    .map(bandOf)
    .filter((band): band is PrizeBand => band !== null)
    .sort((a, b) => a.from - b.from);
}

/**
 * The band a finishing place claims, or null when nothing can be claimed for
 * it with certainty.
 *
 * A tie only earns a band when the WHOLE tie fits inside it. That is the one
 * rule this needs and the reason it takes a span rather than a place: on a
 * 30-team draw the last seventeen teams are tied across places 14 to 30, while
 * the organiser's lowest band pays "9th-16th". Matching on the tie's best place
 * alone would have shown a gold reward to all seventeen, when at most three of
 * them are inside the band and there is nothing here that says which. A tie that
 * straddles the edge of a band is an unknown, so it is left blank.
 */
export function rewardFor(
  span: PlaceSpan,
  bands: PrizeBand[],
): TournamentPrizeTier | null {
  const band = bands.find((b) => span.from >= b.from && span.to <= b.to);
  return band?.tier ?? null;
}

/**
 * The reward as one line.
 *
 * Only the first entry, because a band's later lines are the organiser's notes
 * rather than more prize ("Prizes are displayed for the Playoff stage of the
 * Tournament..." sits in one of them). The full text stays available on hover.
 */
export function rewardLine(tier: TournamentPrizeTier): string {
  return tier.prizes[0] ?? "";
}
