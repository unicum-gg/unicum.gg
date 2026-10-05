import type { PlayerClanHistoryFull } from "../clans/player-history";

/**
 * Threshold for keeping a language alongside the leader. Anything scoring
 * at least half of the top survives. Generous enough to surface a genuinely
 * co-dominant second language (a bilingual player, or a long monolingual
 * stint that competes with the leader), tight enough to drop incidental
 * cameos.
 */
const KEEP_RATIO = 0.5;

/**
 * Guesses which language(s) a player speaks by attributing every day they
 * spent in a clan to that clan's declared languages, then returning the
 * language(s) that captured the most time.
 *
 * Each stint contributes its duration **split equally** across the clan's
 * declared languages: a 90-day stay in a {fr} clan adds 90d to fr, while
 * a 90-day stay in {en,ru,uk} adds 30d to each. Without this split,
 * multi-language "international" clans would over-weight the languages
 * they declare (en/ru/uk are commonly listed together on EU) and drown
 * out the signal from monolingual stints that are actually more telling
 * about the player's own language.
 *
 * Worked example: 5 years in {fr} + 3 years in {fr,en}
 *   fr score = 5y + 1.5y = 6.5y
 *   en score = 0   + 1.5y = 1.5y, so fr dominates and we return ["fr"]
 *
 * Co-dominance: languages scoring at least half the leader survive, so a
 * genuinely bilingual player (or someone who spent comparable time in two
 * monolingual communities) shows multiple flags.
 *
 * Returns [] when no clan in the history carries language metadata.
 */
export function inferPlayerLanguages(
  history: PlayerClanHistoryFull,
  nowMs: number,
): string[] {
  return scoreLanguageStints(stintsOf(history, nowMs));
}

/**
 * One stay in a clan, reduced to the only two things the scoring reads.
 *
 * It exists so a caller that does NOT hold a deserialized history can still get
 * the same answer. The marks board's hourly pass is exactly that: it pulls the
 * language arrays and the durations straight out of the stored JSON in SQL,
 * because reading the whole history document for forty thousand accounts would
 * move a hundred megabytes of clan metadata to score a handful of two-letter
 * codes. What it must not do is score them differently, which is the whole
 * reason this type is here instead of a second implementation.
 */
export type LanguageStint = {
  languages: string[];
  durationMs: number;
};

function* stintsOf(
  history: PlayerClanHistoryFull,
  nowMs: number,
): Generator<LanguageStint> {
  if (history.currentStint) {
    yield {
      languages: history.currentStint.clan.languages,
      durationMs: nowMs - history.currentStint.joinedAt.getTime(),
    };
  }
  for (const s of history.pastStints) {
    if (!s.leftAt) continue;
    yield {
      languages: s.clan.languages,
      durationMs: s.leftAt.getTime() - s.joinedAt.getTime(),
    };
  }
}

/**
 * The scoring itself: split each stay across the clan's declared languages,
 * sum, and keep everything within `KEEP_RATIO` of the leader.
 *
 * Dominant language first, which is what lets a caller showing one flag show
 * the right one.
 */
export function scoreLanguageStints(
  stints: Iterable<LanguageStint>,
): string[] {
  const scores = new Map<string, number>();

  for (const { languages, durationMs } of stints) {
    if (languages.length === 0 || durationMs <= 0) continue;
    const share = durationMs / languages.length;
    for (const lang of languages) {
      scores.set(lang, (scores.get(lang) ?? 0) + share);
    }
  }

  if (scores.size === 0) return [];

  const max = Math.max(...scores.values());
  const threshold = max * KEEP_RATIO;
  return [...scores.entries()]
    .filter(([, score]) => score >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);
}
