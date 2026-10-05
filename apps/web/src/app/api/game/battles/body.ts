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
   *
   * Bounded at what a JSON number can carry rather than at anything smaller.
   * Asia's ids go past int4 (the largest on this database is 3021341123,
   * and 12.7% of Asia's accounts are above the limit), which is what the
   * `bigint[]` column exists for; the open end of this bound is the column's
   * range, not a guess at how high the game will go.
   */
  account: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER),
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
  /**
   * The medals the battle awarded, by the game's own ids.
   *
   * Absent when there are none, which is almost always: 28 of 6057 measured
   * vehicle records carried any. The cap is well above the most a single
   * vehicle has been seen to take.
   */
  medals: z.array(z.number().int().positive()).max(64).optional(),

  // The rest of what the game's own post-battle panel shows. Optional because
  // the mod sends each only when it is non-zero, and because a client older
  // than this field sends none of them at all.
  sniper: counter.optional(),
  splash: counter.optional(),
  hitsReceived: counter.optional(),
  piercingsReceived: counter.optional(),
  bounced: counter.optional(),
  potential: counter.optional(),
  repaired: counter.optional(),
  /** Metres driven, which on a long Frontline runs past a counter's cap. */
  mileage: z.number().int().min(0).max(10_000_000).optional(),
  defended: counter.optional(),
  teamDamage: counter.optional(),
  /** Enemy vehicles damaged, which the game shows beside the ones destroyed. */
  damaged: counter.optional(),
  /** A battle-scoped vehicle id, not an account. */
  killer: z.number().int().positive().optional(),
});

/**
 * What the battle earned the client reporting it.
 *
 * Accepted once per battle rather than per vehicle, because that is what it
 * is: the results carry it for the reporting account alone. Every field is
 * optional, the mod sending each only when non-zero.
 */
const economy = z.object({
  creditsBase: counter.optional(),
  creditsBooster: counter.optional(),
  creditsEvent: counter.optional(),
  creditsOrder: counter.optional(),
  creditsPenalty: counter.optional(),
  creditsCompensation: counter.optional(),
  creditsSubtotal: counter.optional(),
  repairCost: counter.optional(),
  ammoCost: counter.optional(),
  suppliesCost: counter.optional(),
  credits: counter.optional(),
  xpBase: counter.optional(),
  xpBooster: counter.optional(),
  xpEvent: counter.optional(),
  xpPremiumVehicle: counter.optional(),
  xpPenalty: counter.optional(),
  xp: counter.optional(),
  freeXp: counter.optional(),
  crewXp: counter.optional(),
  bonds: counter.optional(),
  bondsBase: counter.optional(),
  premium: z.boolean().optional(),
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
    // No leading zeros, because the column is text: `0123` and `123` would be
    // two battles for one id, and twenty paddings would store it twenty
    // times. `normaliseBattleId` strips them anyway, so this only refuses
    // what is not a number at all.
    .regex(/^(0|[1-9][0-9]{0,19})$/, "the battle id is digits"),
  /** `arenaCreateTime`, the battle's own start, in seconds. */
  startedAt: z.number().int().positive(),
  /** `45_north_america`, the arena's name rather than its display title. */
  mapName: z.string().min(1).max(64),
  /** The game's own `bonusType`: 1 random, 43 onslaught, 20/21 skirmishes. */
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
  /** The sender's own economy, which only the sender can have. */
  personal: economy.optional(),
});

export const battlesUploadBody = z.object({
  // No `region` field. The region comes from the proven account, and a copy of
  // it in the body would be a claim nobody reads: `loadoutsUploadBody` carries
  // one and its route ignores it.
  battles: z.array(battleBody).min(1).max(MAX_BATTLES_PER_UPLOAD),
});

export type BattleBody = z.infer<typeof battleBody>;
export type BattlesUploadBody = z.infer<typeof battlesUploadBody>;
