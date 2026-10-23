/** How a battle ended for one side, as the battles list can be filtered on it.
 * A battle that named no winner has none, and no filter finds it. */
export enum BattleResultFilter {
  Win = "win",
  Loss = "loss",
  Draw = "draw",
}
