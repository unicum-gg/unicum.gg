import type { PlayerClanHistoryFull } from "@unicum.gg/shared";

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
  const scores = new Map<string, number>();

  const accumulate = (langs: string[], durationMs: number) => {
    if (langs.length === 0 || durationMs <= 0) return;
    const share = durationMs / langs.length;
    for (const lang of langs) {
      scores.set(lang, (scores.get(lang) ?? 0) + share);
    }
  };

  if (history.currentStint) {
    accumulate(
      history.currentStint.clan.languages,
      nowMs - history.currentStint.joinedAt.getTime(),
    );
  }
  for (const s of history.pastStints) {
    if (!s.leftAt) continue;
    accumulate(
      s.clan.languages,
      s.leftAt.getTime() - s.joinedAt.getTime(),
    );
  }

  if (scores.size === 0) return [];

  const max = Math.max(...scores.values());
  const threshold = max * KEEP_RATIO;
  return [...scores.entries()]
    .filter(([, score]) => score >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);
}
