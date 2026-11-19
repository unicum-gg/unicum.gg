import { battleIdIn, type ReplayHeader } from "./parse";

/**
 * A battle as the mod declares it, rebuilt out of a `.wotreplay` alone.
 *
 * A finished replay carries two JSON blocks in the clear ahead of its stream:
 * the first holds the map, the gameplay, the client version and who recorded
 * it, the second is the very results `postResult` hands the mod when a battle
 * ends. So a file says everything the mod would have sent, and this is the
 * mod's own `battles/extract.py` (`payload`), ported line for line so a battle
 * declared from a file and the same battle reported live land as one row. A
 * change to one belongs in the other.
 *
 * Unvalidated on purpose: what comes out is checked by the same schema the
 * mod's declarations go through, so there is one definition of an acceptable
 * battle rather than two.
 */

/** The results' own key for each of ours, as the mod renames them. */
const FROM = {
  team: "team",
  tank: "typeCompDescr",
  damage: "damageDealt",
  radio: "damageAssistedRadio",
  track: "damageAssistedTrack",
  stun: "damageAssistedStun",
  blocked: "damageBlockedByArmor",
  received: "damageReceived",
  shots: "shots",
  hits: "directHits",
  piercings: "piercings",
  spotted: "spotted",
  kills: "kills",
  lifeTime: "lifeTime",
  deathReason: "deathReason",
  capturePoints: "capturePoints",
  xp: "xp",
  credits: "credits",
  health: "health",
  maxHealth: "maxHealth",
} as const;

/** The rest of the post-battle panel, sent only when non-zero. */
const EXTRA = {
  sniper: "sniperDamageDealt",
  splash: "explosionHits",
  hitsReceived: "directHitsReceived",
  piercingsReceived: "piercingsReceived",
  bounced: "noDamageDirectHitsReceived",
  potential: "potentialDamageReceived",
  repaired: "healthRepair",
  mileage: "mileage",
  defended: "droppedCapturePoints",
  teamDamage: "tdamageDealt",
  teamKills: "tkills",
  splashReceived: "explosionHitsReceived",
  damaged: "damaged",
} as const;

/** Summed over the records of a vehicle that respawned (Frontline). */
const SUMMED = [
  "damage",
  "radio",
  "track",
  "stun",
  "blocked",
  "received",
  "shots",
  "hits",
  "piercings",
  "spotted",
  "kills",
  "lifeTime",
  "capturePoints",
  "xp",
  "credits",
] as const;

/** What each tank of a multi-tank vehicle is broken down by. */
const TANK = [
  "damage",
  "radio",
  "track",
  "stun",
  "blocked",
  "spotted",
  "kills",
  "xp",
  "lifeTime",
] as const;

/** What `deathReason` says when nobody killed them. Not 0, a real reason. */
const SURVIVED = -1;

/** The recorder's own economy, from `personal.<vehicle>`. */
const PERSONAL = {
  creditsBase: "originalCredits",
  creditsBooster: "boosterCredits",
  creditsEvent: "eventCredits",
  creditsOrder: "orderCredits",
  creditsPenalty: "creditsPenalty",
  creditsCompensation: "creditsContributionIn",
  creditsSubtotal: "subtotalCredits",
  repairCost: "autoRepairCost",
  credits: "credits",
  xpBase: "originalXP",
  xpBooster: "boosterXP",
  xpEvent: "eventXP",
  xpPremiumVehicle: "premiumVehicleXP",
  xpPenalty: "xpPenalty",
  xp: "xp",
  freeXp: "freeXP",
  freeXpBase: "originalFreeXP",
  freeXpBooster: "boosterFreeXP",
  freeXpEvent: "eventFreeXP",
  freeXpOrder: "orderFreeXP",
  freeXpWotPlus: "wotPlusFreeXP",
  freeXpSubtotal: "subtotalFreeXP",
  creditsWotPlus: "wotPlusCredits",
  xpWotPlus: "wotPlusXP",
  piggyBank: "piggyBank",
  crewXp: "tmenXP",
  bonds: "crystal",
  bondsBase: "originalCrystal",
} as const;

/** The two costs the results report as `[credits, gold]`. */
const PERSONAL_LISTS = {
  ammoCost: "autoLoadCost",
  suppliesCost: "autoEquipCost",
} as const;

/** The cluster out of the results' replayURL: `.EU.202.` is `EU-202`. */
const CLUSTER = /\.([A-Z]{2,5})\.([0-9]{1,4})\./;

/** `2.4.0.2` out of `World of Tanks v.2.4.0.2 #966`. */
const VERSION = /v\.\s*([0-9]+(?:\.[0-9]+)+)/;

type Fields = { [key: string]: unknown };

/** Python's `int()` as the mod uses it: anything unreadable is the default. */
function int(value: unknown, fallback = 0): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number)
    ? Math.trunc(number)
    : fallback;
}

function isRecord(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One vehicle's whole battle, however many lives it took. */
function vehicleOf(key: string, records: Fields[]): Fields {
  const first = records[0];
  const last = records[records.length - 1];
  const out: Fields = { id: int(key) };
  const account = int(first.accountDBID);
  // A vehicle with no account is a bot, and has nobody to name.
  if (account) out.account = account;
  for (const [ours, theirs] of Object.entries(FROM)) out[ours] = int(first[theirs]);
  for (const ours of SUMMED) {
    out[ours] = records.reduce((sum, record) => sum + int(record[FROM[ours]]), 0);
  }
  out.health = int(last.health);
  out.deathReason = int(last.deathReason, SURVIVED);
  out.maxHealth = Math.max(...records.map((record) => int(record.maxHealth)));
  const medals = records.flatMap((record) =>
    Array.isArray(record.achievements)
      ? record.achievements.map((one) => int(one)).filter(Boolean)
      : [],
  );
  if (medals.length > 0) out.medals = medals;
  for (const [ours, theirs] of Object.entries(EXTRA)) {
    const total = records.reduce((sum, record) => sum + int(record[theirs]), 0);
    if (total) out[ours] = total;
  }
  // A state the gun arrived with, so the last record's and never a sum.
  const marks = int(last.marksOnGun);
  if (marks) out.marks = marks;
  const killer = int(last.killerID);
  if (killer) out.killer = killer;
  if (records.length > 1) out.tanks = records.map(tankOf);
  return out;
}

function tankOf(record: Fields): Fields {
  const out: Fields = { tank: int(record[FROM.tank]) };
  for (const ours of TANK) out[ours] = int(record[FROM[ours]]);
  out.deathReason = int(record.deathReason, SURVIVED);
  return out;
}

/** What the battle earned the recorder, summed over the tanks they played. */
function personalOf(results: Fields): Fields | null {
  const block = isRecord(results.personal) ? results.personal : {};
  const entries = Object.entries(block)
    .filter(([key, value]) => key !== "avatar" && isRecord(value))
    .map(([, value]) => value as Fields);
  if (entries.length === 0) return null;
  const out: Fields = {};
  for (const [ours, theirs] of Object.entries(PERSONAL)) {
    const value = entries.reduce((sum, own) => sum + int(own[theirs]), 0);
    if (value) out[ours] = value;
  }
  // The mark of excellence is the state of ONE gun, meaningless summed.
  if (entries.length === 1) {
    const mark = int(entries[0].damageRating);
    if (mark) out.markPercent = mark;
  }
  for (const [ours, theirs] of Object.entries(PERSONAL_LISTS)) {
    const cost = entries.reduce((sum, own) => {
      const value = own[theirs];
      return sum + (Array.isArray(value) ? int(value[0]) : int(value));
    }, 0);
    if (cost) out[ours] = cost;
  }
  const daily = Math.max(...entries.map((own) => int(own.dailyXPFactor10)));
  if (daily > 10) out.xpDailyFactor = daily;
  if (entries.some((own) => Boolean(own.isPremium))) out.premium = true;
  return Object.keys(out).length > 0 ? out : null;
}

/** `EU-202` out of the results' own replayURL, or null. */
export function replayCluster(replayUrl: unknown): string | null {
  if (typeof replayUrl !== "string") return null;
  const found = CLUSTER.exec(replayUrl);
  return found ? `${found[1]}-${found[2]}` : null;
}

/**
 * `2.4.0.2` out of `World of Tanks v. 2.4.0.2 #966`.
 *
 * One copy, because every reader of a replay needs it and they must agree. The
 * column exists to keep one patch's figures apart from another's, and two
 * spellings of one build would split that in half -- a comparison that looks
 * right and compares nothing. The xml version rather than the exe's, which the
 * header also carries but which stops at the release before a hotfix, and with
 * the non-breaking spaces the client writes these with folded to ordinary ones.
 */
export function replayClientVersion(full: unknown): string | null {
  if (typeof full !== "string") return null;
  // The client writes these with non-breaking spaces.
  const found = VERSION.exec(full.replace(/ /g, " "));
  return found ? found[1] : null;
}

/** A battle rebuilt from a replay, and the account that recorded it. */
export type ReplayDeclaration = {
  /** The battle, in the shape the mod declares it. Unvalidated. */
  battle: Fields;
  /** `playerID` of the metadata block: whose client recorded the file. */
  recorder: number | null;
};

/**
 * The battle a replay describes, or null when it carries no results.
 *
 * Null is ordinary: about one replay in twenty is a battle its player left
 * before it ended, and the results block is only written at the end.
 *
 * The battle id is read from the raw text, never from the parsed block: it
 * runs to nineteen digits and `JSON.parse` rounds it.
 */
/**
 * Whose client recorded a replay: `playerID` in its metadata block, which is
 * written when recording starts, so even a battle left before its end has it.
 */
export function replayRecorder(header: ReplayHeader): number | null {
  const meta = isRecord(header.blocks[0]) ? header.blocks[0] : {};
  return int(meta.playerID) || null;
}

export function declarationFromReplay(
  header: ReplayHeader,
): ReplayDeclaration | null {
  const meta = isRecord(header.blocks[0]) ? header.blocks[0] : {};
  const recorder = replayRecorder(header);
  let results: Fields | null = null;
  for (const part of header.blocks.slice(1)) {
    const candidate = Array.isArray(part) ? part[0] : part;
    if (isRecord(candidate) && candidate.arenaUniqueID) {
      results = candidate;
      break;
    }
  }
  const arenaUniqueId = battleIdIn(header);
  if (!results || !arenaUniqueId) return null;

  const common = isRecord(results.common) ? results.common : {};
  const vehicles = isRecord(results.vehicles) ? results.vehicles : {};
  const startedAt = int(common.arenaCreateTime);
  const mapName = typeof meta.mapName === "string" ? meta.mapName : null;
  if (!startedAt || !mapName) return null;

  const rows: Fields[] = [];
  for (const [key, entry] of Object.entries(vehicles)) {
    const records = (Array.isArray(entry) ? entry : [entry]).filter(isRecord);
    if (records.length > 0) rows.push(vehicleOf(key, records));
  }
  if (rows.length === 0) return null;

  const personal = isRecord(results.personal) ? results.personal : {};
  const avatar = isRecord(personal.avatar) ? personal.avatar : {};
  const battle: Fields = {
    arenaUniqueId,
    startedAt,
    mapName,
    battleType: int(common.bonusType),
    gameplayId: typeof meta.gameplayID === "string" ? meta.gameplayID : null,
    duration: int(common.duration),
    winnerTeam: int(common.winnerTeam),
    finishReason: int(common.finishReason),
    clientVersion:
      replayClientVersion(meta.clientVersionFromXml) ??
      replayClientVersion(meta.clientVersionFromExe),
    server: replayCluster(avatar.replayURL),
    vehicles: rows.sort((a, b) => int(a.id) - int(b.id)),
  };
  const own = personalOf(results);
  if (own) battle.personal = own;
  return { battle, recorder };
}
