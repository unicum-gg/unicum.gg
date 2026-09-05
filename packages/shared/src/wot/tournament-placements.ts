/**
 * How a tournament's finishing order is read, shared by the page that draws it
 * and the pass that writes the winner's crest.
 *
 * ONE implementation on purpose: the two ran on separate copies and disagreed,
 * which is the worst possible outcome for a mark that claims a result. The
 * bracket page showed ENIGMA winning EU tournament 5000015153 while the crest
 * was awarded to Piranhas, who had won the match FOR THIRD.
 */

/** The minimum a caller has to hand over: stages, their groups, and the
 * standings inside them. Both the API payload and the DB rows satisfy it. */
export type PlacementStage = {
  groups: { standings: { teamId: number; position: number | null }[] }[];
};

/**
 * The range of places each stored position covers: `from` is the best place of
 * the tie and `to` its worst, so a place only one team holds has `from === to`.
 *
 * A knockout records a NON-DENSE placement: everyone out in the same round ties,
 * so a 30-team bracket's stored places run 1, 2, 4, 4, 8, 8, 8, 8, 13... That is
 * the result, not a numbering bug, and renumbering them 1..n would invent a
 * ranking the tournament never decided.
 *
 * The stored number is the LOWEST place of the tie: the two beaten
 * semi-finalists take places 3 and 4 and are both recorded as 4. Wargaming
 * reads it that way too, banding its rewards as "3rd-4th place", "5th-8th
 * place". Checking it adds up is what catches an inverted span: 1 + 1 + 2 + 4 +
 * 5 + 17 covers exactly the 30 teams that entered.
 *
 * Shown, though, a tie takes its BEST place, which is how a ranking is normally
 * written: two teams tied for third are both 3rd and the next one is 5th, not
 * "3-4" twice. So the stored 4 displays as 3, the stored 8 as 5, and so on.
 *
 * The worst place is kept rather than thrown away because it is what says how
 * far a tie reaches, and a reward band can only be claimed for a tie that fits
 * inside it.
 */
export type PlaceSpan = { from: number; to: number };

export function placeSpans(
  placements: Map<number, number>,
): Map<number, PlaceSpan> {
  const counts = new Map<number, number>();
  for (const place of placements.values()) {
    counts.set(place, (counts.get(place) ?? 0) + 1);
  }
  const spans = new Map<number, PlaceSpan>();
  for (const [place, held] of counts) {
    // Floored at 1: a tie can only run back to first, and a caller that hands in
    // per-group standings (several teams recorded as 1st) would otherwise
    // produce a place of zero or less.
    spans.set(place, { from: Math.max(1, place - held + 1), to: place });
  }
  return spans;
}

/**
 * The finishing order, when the tournament recorded one.
 *
 * Read off a stage's standings rather than off the tree, since that is where a
 * placement lives, and only from a stage that is a SINGLE bracket: a stage of
 * parallel groups (a qualifier drawn into five brackets, a group stage of two
 * pools) numbers its standings per group, so every pool has a 1st. Flattening
 * those claimed several winners for one tournament.
 *
 * The last such stage is usually the answer, but not always: a third-place
 * match is filed as its OWN stage, so the last one is a two-team bracket whose
 * winner is "1st" of a match for third. Taken at face value it crowned the
 * third-placed team and left every other team unplaced.
 *
 * What identifies it is not its title, which is free text, but its shape: every
 * one of its teams is tied at the same place in the stage before it. That is
 * what a decider IS, so it is read as one, and its order splits that tie
 * instead of replacing the tournament. Teams that reach a later stage on merit
 * hold DIFFERENT places in the earlier one, so a real final stage is untouched.
 */
export function finalPlacements(
  stages: PlacementStage[],
): { position: number; teamId: number }[] {
  const single = stages.filter((stage) => stage.groups.length === 1);
  if (single.length === 0) return [];

  let base = single[single.length - 1]!;
  let decider: PlacementStage | null = null;
  const previous = single[single.length - 2];
  if (previous) {
    const before = new Map(
      previous.groups[0]!.standings
        .filter((s) => s.position !== null)
        .map((s) => [s.teamId, s.position!]),
    );
    const contenders = base.groups[0]!.standings.map((s) => s.teamId);
    const places = contenders.map((id) => before.get(id));
    const allTied =
      contenders.length > 0 &&
      contenders.length < before.size &&
      places.every((place) => place !== undefined) &&
      new Set(places).size === 1;
    if (allTied) {
      decider = base;
      base = previous;
    }
  }

  const placed = new Map(
    base.groups[0]!.standings
      .filter((s) => s.position !== null)
      .map((s) => [s.teamId, s.position!]),
  );

  if (decider) {
    // The tie runs from `shared - n + 1` to `shared`, since a stored place is
    // its LOWEST. The decider's own order hands those out, so its winner takes
    // the best of them.
    const order = decider
      .groups[0]!.standings.filter((s) => s.position !== null)
      .slice()
      .sort((a, b) => a.position! - b.position!)
      .map((s) => s.teamId);
    const shared = placed.get(order[0]!);
    if (shared !== undefined) {
      order.forEach((teamId, i) => {
        placed.set(teamId, shared - order.length + 1 + i);
      });
    }
  }

  return [...placed]
    .map(([teamId, position]) => ({ teamId, position }))
    .sort((a, b) => a.position - b.position);
}
