import type { TournamentRecord } from "./record";

/**
 * The place a prize band opens on, read off the organiser's own title.
 *
 * There is nothing else to read it from: the tournament system stores a band as
 * free text plus an `order` that repeats (a real tournament ships 1, 2, 3, 4, 4),
 * so the title is the only thing that says which places a band pays. And it is
 * written by hand, differently every time: across the three regions the same
 * band appears as "3-4:", "3rd/4th Place", "3rd & 4th places:" and "3rd:".
 *
 * So the rule is deliberately narrow: a leading number, with or without its
 * ordinal suffix, and nothing else counts. That reads every one of those forms
 * and refuses the two that would otherwise be misread, a band titled "*" (the
 * catch-all a couple of thousand tournaments use for "everyone else") and one
 * titled "Stage 1", which is a phase of the tournament rather than a placing and
 * would have taken the winner's medal.
 */
export function bandPlace(title: string): number | null {
  const m = /^\s*(\d+)\s*(?:st|nd|rd|th)?\b/i.exec(title);
  if (!m) return null;
  const place = Number(m[1]);
  return Number.isFinite(place) && place > 0 ? place : null;
}

/**
 * The band's own label, minus the separator it was written with.
 *
 * Organisers write the title as the head of a sentence the reward completes
 * ("1st place:"), so the trailing colon is punctuation for a layout we no longer
 * use: the reward has its own column. Nothing else is rewritten, since the rest
 * is the organiser's wording and "correcting" it would be inventing a band they
 * did not announce.
 */
export function bandLabel(title: string): string {
  return title.trim().replace(/\s*[:\-–]\s*$/, "");
}

/**
 * The bands in paying order, split from the footnotes filed alongside them.
 *
 * Wargaming's own boilerplate ships as a prize band titled `*` whose "prize" is
 * a sentence ("Monetary prizes are not provided by Wargaming and Wargaming does
 * not take any responsibility for the delivery of the prizes."). It is a
 * footnote, marked as one by the organiser, and in a ranked table it became a
 * paragraph right-aligned under a Prize heading. Only that exact marker is
 * pulled out: a band with a title that simply is not a placing (`Stage 1`) is
 * still a band and keeps its row, just without a number.
 *
 * `order` sorts the bands but does not name them, so it decides sequence only.
 */
export function splitTiers(tiers: TournamentRecord["prizeTiers"]): {
  bands: TournamentRecord["prizeTiers"];
  notes: string[];
} {
  const sorted = tiers.slice().sort((a, b) => a.order - b.order);
  return {
    bands: sorted.filter((tier) => tier.title.trim() !== "*"),
    notes: sorted
      .filter((tier) => tier.title.trim() === "*")
      .map((tier) => tier.prizes.join(" "))
      .filter(Boolean),
  };
}

/** The places a band pays, both ends inclusive. */
export type BandRange = { from: number; to: number };

/**
 * The span a band covers, so a placing can be matched to what it won.
 *
 * A band is written as a range about as often as it is written as a single
 * place, and again in whatever punctuation the organiser reached for: "3rd-4th
 * place", "5th/8th Place", "3rd & 4th places:", "9-16:". The second number is
 * read the same narrow way as the first, and a band that names only one place
 * covers only that place, which is what keeps a 20th-placed team from being
 * credited with the "9th-16th" reward.
 */
export function bandRange(title: string): BandRange | null {
  const from = bandPlace(title);
  if (from === null) return null;
  const span =
    /^\s*\d+\s*(?:st|nd|rd|th)?\s*(?:[-–—/&,]|to\b|and\b)\s*(\d+)/i.exec(title);
  const to = span ? Number(span[1]) : from;
  return { from, to: Number.isFinite(to) && to >= from ? to : from };
}

/**
 * What a team finishing in `place` took home, or null when nothing covers it.
 *
 * The join exists nowhere upstream: the prize table names bands and the bracket
 * names placings, and neither page Wargaming publishes puts the two together, so
 * a team's own page never says what its run was worth.
 */
export function prizeForPlace(
  tiers: TournamentRecord["prizeTiers"],
  place: number,
): string | null {
  for (const tier of tiers) {
    const range = bandRange(tier.title);
    if (range && place >= range.from && place <= range.to) {
      const prize = tier.prizes.join(" · ").trim();
      if (prize) return prize;
    }
  }
  return null;
}
