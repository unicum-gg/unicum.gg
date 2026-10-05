import * as z from "zod";

/**
 * One vehicle's path through the battle.
 *
 * `[tenths of a second, x, z]`, in the arena's own metres, thinned to two
 * samples a second and rounded to whole metres: a tank moves eight metres
 * between samples on a map drawn five hundred pixels across for a kilometre,
 * so four pixels. No height, because a minimap is a plan view and a tank on a
 * hill is at the same place on it as one under the hill.
 */
export const BattleReplayTrack = z.object({
  id: z.number().meta({
    description:
      "The battle-scoped vehicle id, the same one the battle's participants are keyed by.",
  }),
  points: z.array(z.array(z.number()).length(3)).meta({
    description:
      "The path, as [tenths of a second since the battle started, x, z]. Only the moments the vehicle moved: between two points it is exactly where it stopped.",
  }),
});

export const BattleReplayResponse = z.object({
  duration: z.number().meta({
    description: "How long the recording runs, in seconds.",
  }),
  hz: z.number().meta({
    description: "Samples a second the points were thinned to.",
  }),
  tracks: z.array(BattleReplayTrack).meta({
    description:
      "One entry per vehicle this battle's recording client could see. A vehicle it never spotted has no track, which is honest fog of war rather than a gap.",
  }),
});
