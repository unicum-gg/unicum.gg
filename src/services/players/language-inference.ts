import type { PlayerClanHistoryFull } from "@/services/wargaming/wot/clans/player";

/**
 * Guesses which language(s) a player speaks by attributing every day they
 * spent in a clan to that clan's declared languages, then returning the
 * language(s) that captured the most time.
 *
 * Worked example: 5 years in a {fr} clan + 3 years in a {fr,en} clan
 *   fr score = 5y + 3y = 8y
 *   en score = 0y + 3y = 3y → fr dominates → returns ["fr"]
 *
 * Languages within 20% of the leader's score are returned together, so a
 * genuinely bilingual player (always in clans declaring both languages)
 * surfaces multiple flags, while a brief detour into another-language clan
 * doesn't dilute the dominant inference.
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
    for (const lang of langs) {
      scores.set(lang, (scores.get(lang) ?? 0) + durationMs);
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
  const threshold = max * 0.8;
  return [...scores.entries()]
    .filter(([, score]) => score >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);
}
