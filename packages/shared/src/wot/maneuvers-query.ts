/** Which half of a Maneuvers edition a request pages through. */
export enum ManeuversBoardKind {
  Players = "players",
  Clans = "clans",
}

/** The columns a Maneuvers board can be ordered on. Fame Points is the board's
 * own order, so sorting on it is sorting by place. */
export enum ManeuversSort {
  FamePoints = "fame-points",
  Gain = "gain",
  Move = "move",
}

export enum ManeuversOrder {
  Desc = "desc",
  Asc = "asc",
}
