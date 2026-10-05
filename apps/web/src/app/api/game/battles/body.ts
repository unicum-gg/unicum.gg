import { z } from "zod";
import { MAX_BATTLES_PER_UPLOAD } from "@unicum.gg/core/battles/ingest";

/**
 * What the mod may send about a battle.
 *
 * Validated rather than trusted, even though the account sending it is proven.
 * Two different reasons, and both matter:
 *
 * - a genuine client on a game patch we have not read yet can send a shape we
 *   did not plan for, and the client's own results have gained and lost keys
 *   before. A battle that reaches the database malformed is one every reader
 *   then has to survive;
 * - the account is proven, but a battle is a statement about **thirty
 *   accounts**, only one of which is the sender's. That is unlike every other
 *   thing the mod uploads, and it is why the route also checks the sender is
 *   among the players it names. Nothing here can make a battle true; what it
 *   can do is keep a malformed or absurd one out.
 *
 * The caps are set above anything the game has been seen to produce, so they
 * reject nonsense without second-guessing a client we have not met.
 */

/** A counter the game reports per vehicle: never negative, never absurd. */
const counter = z.number().int().min(0).max(1_000_000);

const vehicle = z.object({
  /** Battle-scoped vehicle id, the key the client's results are mapped by. */
  id: z.number().int(),
  /**
   * Wargaming account id, left out for a bot.
   *
   * Optional because bot-filled modes exist, not as a convenience: a vehicle
   * without an account is a real thing the results report, and dropping those
   * rows would make a team look smaller than it was.
   */
  account: z.number().int().positive().optional(),
  team: z.number().int().min(0).max(32),
  /** `typeCompDescr`, the vehicle the account brought. */
  tank: z.number().int().positive(),
  damage: counter,
  radio: counter,
  track: counter,
  stun: counter,
  blocked: counter,
  received: counter,
  shots: counter,
  hits: counter,
  piercings: counter,
  spotted: counter,
  kills: z.number().int().min(0).max(60),
  /** Seconds alive; the battle's own duration when they survived it. */
  lifeTime: counter,
  /**
   * `-1` when they survived, otherwise the game's own reason code.
   *
   * Not `0`: that is a real reason, and the commonest one. Measured over 1424
   * replays the codes run 0..29 with gaps, which is why this is capped well
   * above the highest seen rather than at it: a new mode adds reasons, and a
   * battle is not worth refusing over a number we have not met.
   */
  deathReason: z.number().int().min(-1).max(255),
  capturePoints: counter,
  xp: counter,
  credits: counter,
  /** Hit points left, which goes **negative** on the shot that overkills. */
  health: z.number().int().min(-100_000).max(100_000),
  maxHealth: counter,
});

export const battleBody = z.object({
  /**
   * The game's own battle id, as a string.
   *
   * It runs to 19 digits, which no JSON number survives: the mod sends it as
   * text and the column is text, so the value that crosses the wire is the
   * value the game produced. A number here would silently round, and two
   * battles that round together would deduplicate into one.
   */
  arenaUniqueId: z
    .string()
    .regex(/^[0-9]{1,20}$/, "the battle id is digits"),
  /** `arenaCreateTime`, the battle's own start, in seconds. */
  startedAt: z.number().int().positive(),
  /** `45_north_america`, the arena's name rather than its display title. */
  mapName: z.string().min(1).max(64),
  /** The game's `bonusType`: 1 random, 43 onslaught, 20/21 skirmishes. */
  battleType: z.number().int().min(0).max(255),
  /** `ctf`, `domination`, `assault`… */
  gameplayId: z.string().min(1).max(32).nullish(),
  /** Seconds. */
  duration: z.number().int().min(0).max(24 * 3600).nullish(),
  /** The team that won, 0 for a draw. */
  winnerTeam: z.number().int().min(0).max(32).nullish(),
  // Seen as high as 202, so the cap is the byte rather than the range the
  // modes we have looked at happen to use.
  finishReason: z.number().int().min(0).max(255).nullish(),
  /** The client that played it, which is what makes a replay playable. */
  clientVersion: z.string().min(1).max(32).nullish(),
  /** The physical cluster, `EU-201`. */
  server: z.string().min(1).max(32).nullish(),
  // Thirty in a random battle, fourteen in a skirmish, sixty in Frontline, all
  // measured. The cap is here to refuse a payload that is not a battle at all.
  vehicles: z.array(vehicle).min(1).max(120),
});

export const battlesUploadBody = z.object({
  /**
   * Named only on the unlinked path: a linked client's region comes from the
   * account the link belongs to, which is a fact rather than a claim.
   */
  region: z.string().min(2).max(8).optional(),
  battles: z.array(battleBody).min(1).max(MAX_BATTLES_PER_UPLOAD),
});

export type BattleBody = z.infer<typeof battleBody>;
export type BattlesUploadBody = z.infer<typeof battlesUploadBody>;
