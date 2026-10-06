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
  diedAt: z.number().nullable().meta({
    description:
      "The clock tick this vehicle was destroyed, or null if it survived or the recording cannot say. In the recording's clock, which runs about fifty seconds ahead of the battle's because it starts during the countdown.",
  }),
  points: z.array(z.array(z.number()).length(3)).meta({
    description:
      "The path, as [clock ticks since the battle started, x, z in the arena's own metres]. Every position the recording client was shown, which is about ten a second; only the moments the vehicle actually moved are kept, so between two points it stood still.",
  }),
});

export const BattleReplayResponse = z.object({
  duration: z.number().meta({
    description: "How long the recording runs, in seconds.",
  }),
  ticksPerSecond: z.number().meta({
    description:
      "Clock ticks a second in each point's first value. Hundredths, so a point's instant in seconds is its tick divided by this.",
  }),
  tracks: z.array(BattleReplayTrack).meta({
    description:
      "One entry per vehicle this battle's recording client could see. A vehicle it never spotted has no track, which is honest fog of war rather than a gap.",
  }),
});
