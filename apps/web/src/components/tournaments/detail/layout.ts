import { BracketType } from "@unicum.gg/wargaming";
import type { TournamentMatch } from "./record";

// Geometry of a drawn bracket. Shared by the layout maths and the CSS, so the
// two cannot drift: a card whose rendered height differs from CARD_H would sit
// off its own connector.
export const CARD_W = 208;
// Measured, not guessed: two 32px team rows, their 1px separator, and the 22px
// map footer under it. A card shorter than its content clips the footer, and one
// taller floats off the connector the layout drew to its middle, so this is the
// number both sides of that contract agree on.
export const CARD_H = 88;
export const COL_GAP = 44;
/** Vertical space between two matches that feed the same tie. */
export const ROW_GAP = 12;

export type PlacedMatch = {
  match: TournamentMatch;
  x: number;
  y: number;
};

/** A line from a feeder to the tie it advances into. */
export type BracketEdge = { from: PlacedMatch; to: PlacedMatch };

export type BracketLayout = {
  columns: { round: number; x: number }[];
  placed: PlacedMatch[];
  edges: BracketEdge[];
  width: number;
  height: number;
};

/**
 * What a round is called, which depends on the bracket it belongs to.
 *
 * Both count from the END, so 1 is the last winners round and the number grows
 * outwards. What the SIGN means is where the two differ, and getting it wrong is
 * not cosmetic:
 *
 *  - **Single elimination** uses positives only, plus `-1` for the third-place
 *    match. A round `n` away from the final has 2^n teams in it, which is what
 *    makes "Round of 16" computable.
 *  - **Double elimination** uses the sign to say which bracket: positives are
 *    the winners bracket, negatives the LOSERS bracket (not a third-place
 *    match), and `0` is the grand final between them. Half of a double
 *    elimination's matches live at a negative round.
 *
 * The names are Wargaming's own, from the `bracket_types[].rounds` catalogue the
 * tournament endpoint publishes.
 */
export function roundLabel(round: number, bracket: BracketType): string {
  if (bracket === BracketType.DoubleElimination) {
    if (round === 0) return "Grand Final";
    if (round === 1) return "Winner Bracket Final";
    if (round === -1) return "Loser Bracket Final";
    return round > 0 ? `Winner Round ${round}` : `Loser Round ${-round}`;
  }
  if (round === -1) return "Third place";
  if (round === 1) return "Final";
  if (round === 2) return "Semi-finals";
  if (round === 3) return "Quarter-finals";
  return `Round of ${2 ** round}`;
}

/**
 * The order the columns read in.
 *
 * Single elimination runs outside-in (the biggest round first, the final last)
 * with the third-place match parked at the end, beside the final rather than
 * before it. Double elimination reads as its three parts: the winners bracket
 * down to its final, then the losers bracket down to its own, then the grand
 * final that decides between them.
 */
export function orderedRounds(rounds: number[], bracket: BracketType): number[] {
  if (bracket === BracketType.DoubleElimination) {
    const winners = rounds.filter((r) => r > 0).sort((a, b) => b - a);
    const losers = rounds.filter((r) => r < 0).sort((a, b) => a - b);
    const grandFinal = rounds.filter((r) => r === 0);
    return [...winners, ...losers, ...grandFinal];
  }
  const main = rounds.filter((r) => r > 0).sort((a, b) => b - a);
  const thirdPlace = rounds.filter((r) => r <= 0).sort((a, b) => b - a);
  return [...main, ...thirdPlace];
}

/**
 * Place every tie on a grid and work out which lines join them.
 *
 * Laid out from the ROOT down, not column by column. A bracket reads as a tree,
 * so the position of a tie is decided by the ties that feed it, and the only way
 * to get that right is to walk the tree the source publishes
 * (`nextMatchForWinner`) depth-first: a match with feeders sits centred between
 * them, and a match with none takes the next free row IN TREE ORDER.
 *
 * That last clause is the whole fix. Column order and tree order are not the
 * same thing once a draw is not a full power of two: a 20-team bracket plays
 * four first-round ties and gives twelve teams a bye, so the four are a quarter
 * of the column but their winners join the second round at four points spread
 * down its height. Filling the first column top-down (its own index) parked them
 * all at the top and left their connectors to travel the full height of the
 * bracket, crossing every card in between.
 */
export function layoutBracket(
  matches: TournamentMatch[],
  bracket: BracketType,
): BracketLayout {
  const byRound = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }
  const rounds = orderedRounds([...byRound.keys()], bracket);

  const byUuid = new Map(matches.map((m) => [m.uuid, m]));
  // Who feeds each tie, from the winner link every match carries.
  const feeders = new Map<string, string[]>();
  for (const m of matches) {
    const target = m.nextMatchForWinner;
    if (!target || !byUuid.has(target)) continue;
    feeders.set(target, [...(feeders.get(target) ?? []), m.uuid]);
  }

  const step = CARD_H + ROW_GAP;
  const ys = new Map<string, number>();
  const seen = new Set<string>();
  let nextRow = 0;

  // Post-order: settle the feeders, then centre the tie between the outermost
  // of them. `seen` guards against a malformed link pointing back into the tree.
  function place(uuid: string): number {
    const already = ys.get(uuid);
    if (already !== undefined) return already;
    seen.add(uuid);
    const kids = (feeders.get(uuid) ?? [])
      .filter((id) => !seen.has(id))
      .sort((a, b) => (byUuid.get(a)?.position ?? 0) - (byUuid.get(b)?.position ?? 0));
    if (kids.length === 0) {
      const y = nextRow * step;
      nextRow += 1;
      ys.set(uuid, y);
      return y;
    }
    const kidYs = kids.map(place);
    const y = (Math.min(...kidYs) + Math.max(...kidYs)) / 2;
    ys.set(uuid, y);
    return y;
  }

  // Every tie nothing advances into is a root: the final, and in a group that
  // also holds a third-place match, that match too.
  const roots = matches
    .filter(
      (m) => !m.nextMatchForWinner || !byUuid.has(m.nextMatchForWinner),
    )
    .sort((a, b) => a.round - b.round || a.position - b.position);
  for (const root of roots) place(root.uuid);
  // Anything the walk never reached (a group whose links are incomplete) still
  // has to be drawn rather than dropped.
  for (const m of matches) if (!ys.has(m.uuid)) place(m.uuid);

  const columns: { round: number; x: number }[] = [];
  const placed = new Map<string, PlacedMatch>();
  rounds.forEach((round, columnIndex) => {
    const x = columnIndex * (CARD_W + COL_GAP);
    columns.push({ round, x });
    // Never stack two ties on the same pixel. The tree walk already separates
    // them, so this only ever bites on a draw whose links do not form one.
    let floor = 0;
    for (const match of (byRound.get(round) ?? [])
      .slice()
      .sort((a, b) => (ys.get(a.uuid) ?? 0) - (ys.get(b.uuid) ?? 0))) {
      const y = Math.max(ys.get(match.uuid) ?? 0, floor);
      floor = y + step;
      placed.set(match.uuid, { match, x, y });
    }
  });

  const all = [...placed.values()];
  const edges: BracketEdge[] = [];
  for (const p of all) {
    const target = p.match.nextMatchForWinner
      ? placed.get(p.match.nextMatchForWinner)
      : undefined;
    // Only forward edges are drawn. A losers bracket feeds backwards across the
    // page in double elimination, and a line running right to left through the
    // other columns would obscure more than it explains.
    if (target && target.x > p.x) edges.push({ from: p, to: target });
  }

  const height = all.reduce((max, p) => Math.max(max, p.y + CARD_H), 0);
  const width = columns.length * (CARD_W + COL_GAP) - COL_GAP;
  return { columns, placed: all, edges, width, height };
}
