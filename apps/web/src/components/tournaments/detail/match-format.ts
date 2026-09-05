/**
 * A match's format, derived from how many maps the organiser listed for it.
 *
 * The tournament system never publishes the format: a match carries a free-text
 * map field ("Cliff, Sand River"), a winner, and a count of battles won on each
 * side. Nothing says Bo3 or Bo5. But the map count turns out to BE the number of
 * wins required, so the format follows from it.
 *
 * Measured across ~36,000 settled EU matches, and the fit is exact at every
 * size, which is what makes it safe to state rather than guess:
 *
 * | maps | battles played                | implies    |
 * |------|-------------------------------|------------|
 * | 1    | 86% ended in 1                | Bo1        |
 * | 2    | 80% in 2, 20% in 3            | Bo3        |
 * | 3    | 58% in 3, 24% in 4, 18% in 5  | Bo5        |
 * | 4    | up to 7                       | Bo7        |
 * | 5    | 5 to 9                        | Bo9        |
 *
 * The 2N-1 maximum comes from how a series is actually laid out, which is the
 * part the numbers alone do not tell you: each map is played TWICE, once from
 * each side, and the last map is the decider played once. Two maps are 2+1
 * battles, three are 2+2+1, five are 2+2+2+2+1. The sub-1% tails past the
 * maximum are replays and forfeits.
 */
export function bestOf(mapCount: number): number | null {
  if (mapCount < 1) return null;
  return mapCount * 2 - 1;
}

/** How the format reads on a row: "Bo3". Null for a single-battle tie, where
 * saying "Bo1" is noise. */
export function bestOfLabel(mapCount: number): string | null {
  const games = bestOf(mapCount);
  return games !== null && games > 1 ? `Bo${games}` : null;
}

/** Which battles of the series a map hosts, and whether it is the decider.
 *
 * Every map but the last is played twice, once from each side, so map `index`
 * (counting from 0) hosts battles `2i+1` and `2i+2`. The last map is the
 * decider and is played once, which is why the series tops out at 2N-1 rather
 * than 2N. A single-map match is that same last map: one battle.
 */
export function battlesOnMap(
  index: number,
  mapCount: number,
): { from: number; to: number; decider: boolean } {
  const decider = index === mapCount - 1;
  const from = index * 2 + 1;
  return decider ? { from, to: from, decider } : { from, to: from + 1, decider };
}

/** One battle of a series: which map it is played on, its number, and whether
 * the sides are the mirror of the match's assignment. */
export type SeriesBattle<T> = { map: T; battle: number; swapped: boolean };

/**
 * Expand a match's maps into the battles actually played.
 *
 * A series is not one battle per map: each map is played twice, once from each
 * side, and only the decider is played once. So two maps are battles 1 and 2 on
 * the first and battle 3 on the second, which is why a Bo3 draws three minimaps
 * rather than two.
 *
 * `played` truncates to what really happened, since a series stops the moment it
 * is decided: a Bo5 won 3-0 was three battles, not five, and drawing the other
 * two would invent them.
 */
export function seriesBattles<T>(maps: T[], played: number): SeriesBattle<T>[] {
  const out: SeriesBattle<T>[] = [];
  maps.forEach((map, index) => {
    const { from, to } = battlesOnMap(index, maps.length);
    for (let battle = from; battle <= to; battle++) {
      if (played > 0 && battle > played) return;
      out.push({ map, battle, swapped: battle !== from });
    }
  });
  return out;
}
