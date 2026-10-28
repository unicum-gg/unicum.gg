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
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
  team: z.number().int().min(0).max(32),
  /**
   * `typeCompDescr`, the vehicle the account brought, when the client had it.
   *
   * Not `positive()`, for the reason `account` above is optional: the client
   * does not always have the descriptor, and a vehicle that arrives with a 0
   * is still a real participant with an account, a team, damage dealt and a
   * time of death. Refusing it would delete a player from the battle and
   * leave the roster saying thirteen where fourteen played, which is a worse
   * answer than one unfilled field. `toRow` turns anything unusable into
   * `null`, and every reader already treats an unknown tank as unnamed.
   *
   * This was found the hard way: one such vehicle, in one skirmish, refused
   * one upload, and because the whole batch was validated as a unit it took
   * thirty-five innocent battles down with it, every garage, for a day.
   */
  tank: z.number().int().nullish(),
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
  /** Allies destroyed, which the game shows beside the damage done to them. */
  teamKills: counter.optional(),
  /** Hits taken from a shell's blast rather than from the shell itself. */
  splashReceived: counter.optional(),
  /** Enemy vehicles damaged, which the game shows beside the ones destroyed. */
  damaged: counter.optional(),
  /** A battle-scoped vehicle id, not an account. */
  killer: z.number().int().positive().optional(),
  /**
   * Marks of excellence painted on this gun, 0 to 3.
   *
   * For EVERY vehicle in the battle, not only the reporting one: the results
   * carry it in the public half, so one report names the marks of all thirty.
   * Absent rather than zero when there are none, so thirty vehicles do not
   * each carry a field saying nothing.
   */
  marks: z.number().int().min(1).max(3).optional(),
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
  /** The free experience behind each experience line, which the game's own
   * report shows as a second column. */
  freeXpBase: counter.optional(),
  freeXpBooster: counter.optional(),
  freeXpEvent: counter.optional(),
  freeXpOrder: counter.optional(),
  freeXpWotPlus: counter.optional(),
  freeXpSubtotal: counter.optional(),
  /** WoT Plus's own bonus to the battle's credits and experience. */
  creditsWotPlus: counter.optional(),
  xpWotPlus: counter.optional(),
  /** Credits put aside in the WoT Plus reserve stock ("piggy bank"). */
  piggyBank: counter.optional(),
  /** The daily first-victory multiplier, times ten: 20 is the x2. */
  xpDailyFactor: z.number().int().min(0).max(1000).optional(),
  crewXp: counter.optional(),
  bonds: counter.optional(),
  bondsBase: counter.optional(),
  premium: z.boolean().optional(),
  /**
   * Where the mark of excellence stood when this battle ended, as a percent.
   *
   * The state AFTER the battle, which is the only one the game gives: there is
   * no `prevDamageRating` to pair with it the way the mastery badge has one.
   * What a battle GAINED is therefore the difference with the last battle in
   * the same tank, which this end can work out and the client cannot.
   *
   * A whole percent, because that is the precision the results carry; the
   * garage knows it to the hundredth and sends that separately. Absent rather
   * than zero: the modes that do not count towards marks report zero, and
   * storing that would read as a gun that lost everything.
   */
  markPercent: z.number().int().min(1).max(100).optional(),
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

/**
 * The upload's envelope, whose battles are checked one at a time.
 *
 * `battles` holds unknowns here, and that is the whole point. A lot validated
 * as a unit fails as a unit: one battle the schema dislikes refuses every
 * battle travelling with it, under a 400 that names none of them. The mod
 * cannot act on that answer. It keeps its queue, sends the same lot at the
 * next garage, and is refused again, every garage, for as long as the bad
 * battle sits at the head of the queue. Measured: one vehicle missing its
 * `typeCompDescr`, in one skirmish, held thirty-five other battles off the
 * site for a day.
 *
 * The route already refuses battle by battle, naming each one and its reason,
 * and answers 200 so the mod can drop exactly what will never be accepted.
 * Validating here one at a time lets the schema's own refusals take that same
 * path instead of cancelling it.
 */
export const battlesUploadEnvelope = z.object({
  // No `region` field. The region comes from the proven account, and a copy of
  // it in the body would be a claim nobody reads: `loadoutsUploadBody` carries
  // one and its route ignores it.
  battles: z.array(z.unknown()).min(1).max(MAX_BATTLES_PER_UPLOAD),
});

export type BattleBody = z.infer<typeof battleBody>;
