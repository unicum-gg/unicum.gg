import type {
  AmmoLayout,
  DevicesLayout,
  LoadoutCrewMember,
  LoadoutSetups,
  LoadoutShell,
} from "../loadouts";
import {
  CREW_ROLES,
  CREW_SKILLS,
  OPTIONAL_DEVICES,
  EQUIPMENTS,
  ITEM_TYPE,
  splitIntCompactDescr,
} from "./loadout-catalogue";
import { SHELLS } from "./loadout-shells";

/**
 * The loadout the recording player actually played, read out of a replay.
 *
 * Not the garage. `tank_loadouts` answers "what does this player run on this
 * tank today", which is replaced every time they change it; this answers "what
 * was fitted in the battle where they did four thousand damage", which is the
 * only form a question about effectiveness can be asked in.
 *
 * **Only the recording player's.** The server strips the optional devices out
 * of every other vehicle's public information before broadcasting it, so a
 * replay holds exactly one equipped vehicle however many took part. Measured
 * rather than assumed: across seven replays, 443 of 443 public compact
 * descriptors carried a zero flags byte, and the arena list of a thirty-player
 * battle holds twenty-nine descriptors of fifteen bytes beside one of
 * twenty-one. What the file does carry about the other players is their
 * modules, which is a different fact read by a different path.
 *
 * **One per life, not one per battle.** In a mode with respawns a player
 * chooses again every time, and the client sends the whole property set afresh,
 * so the same battle yields several of these. Keying them on the battle alone
 * would let the second one overwrite the first in silence.
 *
 * Everything here comes from the `0x06` packet, which carries the property set
 * the client marks `MY_VEHICLE`: the crew with its skills, and the two setup
 * groups with the index of the one in use. The three facts that matter are
 * documented where they are read.
 */

/** One life's loadout, with the clock reading it was sent at. */
export interface ReplayLoadout {
  /** The vehicle entity it belongs to, which is how lives are told apart. */
  entityId: number;
  /** Seconds on the replay's own clock, so a life can be placed in the battle. */
  at: number;
  crew?: LoadoutCrewMember[];
  setups?: LoadoutSetups;
}

/**
 * Nothing here is found by its property index, and that is deliberate.
 *
 * The indices move between client versions. In the 1.29 clients of mid-2025 the
 * crew sits at 36 and the setups at 38; in the 2026 client the same properties
 * are at 35 and 37, because a property in front of them was removed and
 * everything after it shifted by one. Pinning the numbers read nine replays in
 * ten and silently returned nothing for the rest, which is the worst possible
 * failure for a table meant to be aggregated: it looks like players who fitted
 * no equipment rather than like a reader that could not see it.
 *
 * So each value is recognised by what it IS. The setups are the dictionary that
 * has a `devicesSetups` key, the active indices are the dictionary keyed by
 * numbers, and the crew is the run of length-prefixed tankman descriptors that
 * ends exactly where the first of those dictionaries begins. A client that
 * renumbers its properties again changes none of that.
 */

/** The key that identifies the setups dictionary among the others. */
const SETUPS_KEY = "devicesSetups";

/**
 * Which setup group each key of `setupsIndexes` names.
 *
 * The client numbers the groups and does not name them. Established by
 * cross-checking rather than by reading the constant: in a battle whose
 * `setupsIndexes` was `{1: 0, 2: 1}`, the devices of `devicesSetups[1]` were
 * the three found mounted on the player's own vehicle by the other path
 * through its full compact descriptor, which fixes 2 as the devices group and
 * so 1 as the ammunition group.
 */
const GROUP = { ammo: 1, devices: 2 } as const;

/** A crew cannot be larger than this, which bounds the search for one. */
const MAX_CREW = 8;

/** `ITEM_TYPES.tankman`, the low nibble of a crew member's descriptor. */
const TANKMAN = 8;

const u32 = (b: Uint8Array, at: number): number =>
  (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/**
 * The skill a crew member's skill index names, or null for the entries that
 * are not skills at all.
 *
 * Three kinds are refused. `reserved` is a retired skill whose slot was kept
 * so the later ones would not shift. `any` is a free skill slot the player has
 * not spent, which the client counts but has no name for. And the table's
 * first five entries are the ROLE names, which live there because a role and a
 * skill are the same kind of index to the client: counting `commander` as a
 * perk the commander trained would be nonsense, and every aggregate asking how
 * often a perk appears would count it.
 *
 * Here rather than beside the table because it is a judgement, and the table
 * is generated: a regeneration must not be able to revert it.
 */
function crewSkillName(index: number): string | null {
  const name = CREW_SKILLS[index];
  if (!name || name === "reserved" || name === "any") return null;
  return CREW_ROLES.includes(name) ? null : name;
}

/* ------------------------------------------------------------------ pickles */

/**
 * Enough of pickle protocol 2 to read the two dictionaries the client sends.
 *
 * `setups` is `{str: [[int, ...], ...]}` and `setupsIndexes` is `{int: int}`,
 * so this covers dictionaries, lists, tuples, the integer and string opcodes,
 * and the memo instructions that sit between them. It deliberately does not
 * cover `REDUCE`, `GLOBAL` or anything else that would name a Python class:
 * those would mean the client sent an object rather than plain data, which is
 * a shape this does not claim to understand and should refuse rather than
 * guess at.
 *
 * Returns the value and how many bytes it consumed, because the caller uses
 * that length to check the value against the length prefix in front of it.
 */
function readPickle(
  bytes: Uint8Array,
  from: number,
): { value: unknown; length: number } | null {
  const stack: unknown[] = [];
  const marks: number[] = [];
  const memo: unknown[] = [];
  let p = from;

  const text = (at: number, n: number): string =>
    new TextDecoder().decode(bytes.subarray(at, at + n));

  while (p < bytes.length) {
    const op = bytes[p];
    p += 1;
    switch (op) {
      case 0x80: // PROTO
        p += 1;
        break;
      case 0x2e: // STOP
        return { value: stack.pop(), length: p - from };
      case 0x28: // MARK
        marks.push(stack.length);
        break;
      case 0x7d: // EMPTY_DICT
        stack.push(new Map<unknown, unknown>());
        break;
      case 0x5d: // EMPTY_LIST
        stack.push([]);
        break;
      case 0x29: // EMPTY_TUPLE
        stack.push([]);
        break;
      case 0x4e: // NONE
        stack.push(null);
        break;
      case 0x88: // NEWTRUE
        stack.push(true);
        break;
      case 0x89: // NEWFALSE
        stack.push(false);
        break;
      case 0x4b: // BININT1
        stack.push(bytes[p]);
        p += 1;
        break;
      case 0x4d: // BININT2
        stack.push(bytes[p] | (bytes[p + 1] << 8));
        p += 2;
        break;
      case 0x4a: // BININT4
        stack.push(u32(bytes, p) | 0);
        p += 4;
        break;
      case 0x8a: {
        // LONG1: a big integer as a little-endian two's complement run.
        const n = bytes[p];
        p += 1;
        let value = 0;
        for (let i = n - 1; i >= 0; i -= 1) value = value * 256 + bytes[p + i];
        stack.push(value);
        p += n;
        break;
      }
      case 0x55: {
        // SHORT_BINSTRING
        const n = bytes[p];
        stack.push(text(p + 1, n));
        p += 1 + n;
        break;
      }
      case 0x54: {
        // BINSTRING
        const n = u32(bytes, p);
        stack.push(text(p + 4, n));
        p += 4 + n;
        break;
      }
      case 0x58: {
        // BINUNICODE
        const n = u32(bytes, p);
        stack.push(text(p + 4, n));
        p += 4 + n;
        break;
      }
      case 0x71: // BINPUT
        memo[bytes[p]] = stack[stack.length - 1];
        p += 1;
        break;
      case 0x72: // LONG_BINPUT
        memo[u32(bytes, p)] = stack[stack.length - 1];
        p += 4;
        break;
      case 0x68: // BINGET
        stack.push(memo[bytes[p]]);
        p += 1;
        break;
      case 0x6a: // LONG_BINGET
        stack.push(memo[u32(bytes, p)]);
        p += 4;
        break;
      case 0x61: {
        // APPEND
        const item = stack.pop();
        const list = stack[stack.length - 1];
        if (!Array.isArray(list)) return null;
        list.push(item);
        break;
      }
      case 0x65: {
        // APPENDS
        const at = marks.pop();
        if (at === undefined) return null;
        const items = stack.splice(at);
        const list = stack[stack.length - 1];
        if (!Array.isArray(list)) return null;
        list.push(...items);
        break;
      }
      case 0x73: {
        // SETITEM
        const value = stack.pop();
        const key = stack.pop();
        const map = stack[stack.length - 1];
        if (!(map instanceof Map)) return null;
        map.set(key, value);
        break;
      }
      case 0x75: {
        // SETITEMS
        const at = marks.pop();
        if (at === undefined) return null;
        const items = stack.splice(at);
        const map = stack[stack.length - 1];
        if (!(map instanceof Map)) return null;
        for (let i = 0; i + 1 < items.length; i += 2) {
          map.set(items[i], items[i + 1]);
        }
        break;
      }
      case 0x74: {
        // TUPLE
        const at = marks.pop();
        if (at === undefined) return null;
        stack.push(stack.splice(at));
        break;
      }
      case 0x85: // TUPLE1
        stack.push([stack.pop()]);
        break;
      case 0x86: {
        // TUPLE2
        const b = stack.pop();
        const a = stack.pop();
        stack.push([a, b]);
        break;
      }
      case 0x87: {
        // TUPLE3
        const c = stack.pop();
        const b = stack.pop();
        const a = stack.pop();
        stack.push([a, b, c]);
        break;
      }
      default:
        // An opcode this does not read. Refused rather than skipped: the rest
        // of the stream would be read against the wrong stack.
        return null;
    }
  }
  return null;
}

const ints = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((x): x is number => typeof x === "number") : [];

/* ------------------------------------------------------------------ the crew */

/**
 * One crew member out of their compact descriptor.
 *
 * The layout is `makeCompactDescr` in `common/items/tankmen.py`, read in that
 * order: a header whose low nibble is `ITEM_TYPES.tankman`, a flags byte, the
 * vehicle they are trained on, then three big-endian bytes holding the role in
 * their top bits and the training experience in the rest, then the skills.
 *
 * The role is the point. `crewSkillNames` on the garage path deduplicates
 * across the whole crew and throws the role away, which makes "which skill on
 * which seat" unanswerable; keeping the member whole keeps it answerable. It
 * matters most for the five skills every seat can learn -- repair, camouflage,
 * brotherhood, armour patching and firefighting -- where how MANY of the crew
 * trained it is the effect, and a deduplicated list cannot say.
 */
export function readTankman(
  bytes: Uint8Array,
): { member: LoadoutCrewMember; level: number } | null {
  if (bytes.length < 8) return null;
  if ((bytes[0] & 0x0f) !== TANKMAN) return null;

  let p = 1;
  // The flags byte can chain: `MORE_FLAGS_FLAG` in its lowest bit says another
  // follows. Every flag that means anything is in the FIRST byte, though --
  // `TankmanFlags.fromCD` reads all six of them from it and then only counts
  // the extra bytes without re-reading them -- so the rest are skipped rather
  // than taken. Reading the last byte instead of the first, as this did, would
  // lose `extendedVehicleTypeID` and both skill-block flags and walk the
  // descriptor from the wrong offset the moment the client starts chaining.
  const flags = bytes[p];
  p += 1;
  while (bytes[p - 1] & 0x01) {
    if (p >= bytes.length) return null;
    p += 1;
  }
  // `EXTENDED_VEHICLE_TYPE_ID_FLAG`, set when the id does not fit one byte, in
  // which case it arrives big-endian like every other multi-byte field here.
  p += flags & 0x80 ? 2 : 1;
  if (p + 4 > bytes.length) return null;

  const packed = (bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2];
  p += 3;
  // The role is a `SKILL_INDICES` value, so it indexes the SKILL table and not
  // the role table. Those two disagree: the skill table runs commander,
  // radioman, driver, gunner, loader, while the roles run commander, gunner,
  // driver, radioman, loader. Reading the role out of the wrong one swaps the
  // gunner with the radio operator and leaves the other three looking right,
  // which is the kind of mistake that survives every spot check and poisons
  // every per-seat figure built on top of it.
  const role = CREW_SKILLS[packed >> 17];
  if (!role || !CREW_ROLES.includes(role)) return null;

  const count = bytes[p];
  p += 1;
  if (p + count > bytes.length) return null;
  const skills: string[] = [];
  const take = (index: number) => {
    const name = crewSkillName(index);
    if (name) skills.push(name);
  };
  for (let i = 0; i < count; i += 1) take(bytes[p + i]);
  p += count;
  // The level the last skill has reached, which is zero when nothing is
  // trained. Read for the bound it gives, not published: the figure a page
  // wants is the crew's qualification, which is a different number.
  const level = p < bytes.length ? bytes[p] : 0;
  p += 1;

  // The two optional blocks the flags announce, in the order the client writes
  // them. The second one has to be read, not skipped: the mod's own collector
  // is "every perk this tankman carries, taught OR GRANTED", and it adds the
  // role bonuses to the same list. Reading only the taught ones would give
  // this crew six perks where the garage path gives nine, and the whole reason
  // to keep the vocabulary identical is so the two can be counted together.
  if (flags & 0x10) p += 1; // freeSkillsNumber
  if (flags & 0x08) {
    const bonus = bytes[p];
    p += 1;
    if (bonus && p + bonus <= bytes.length) {
      for (let i = 0; i < bonus; i += 1) take(bytes[p + i]);
    }
  }

  return { member: { role, skills }, level };
}

/**
 * The crew block: a count, then one length-prefixed descriptor per member.
 *
 * `crewCompactDescrs` is a `TUPLE<STRING>`, and BigWorld writes such a tuple as
 * its length followed by each entry's. Required to land exactly on `ends`,
 * which is the byte the next property's index sits at: a crew read from the
 * wrong offset almost always runs long or short, and demanding an exact finish
 * is what lets this be found by shape instead of by a fixed offset.
 */
function readCrewAt(
  body: Uint8Array,
  from: number,
  ends: number,
): LoadoutCrewMember[] | null {
  const count = body[from];
  if (!count || count > MAX_CREW) return null;
  const members: LoadoutCrewMember[] = [];
  let p = from + 1;
  for (let i = 0; i < count; i += 1) {
    if (p >= ends) return null;
    const length = body[p];
    if (length < 8 || p + 1 + length > ends) return null;
    const read = readTankman(body.subarray(p + 1, p + 1 + length));
    if (!read) return null;
    members.push(read.member);
    p += 1 + length;
  }
  return p === ends ? members : null;
}

/* --------------------------------------------------------------- the setups */

/** The layouts of the shells-and-consumables group, in the client's order. */
function ammoLayouts(setups: Map<unknown, unknown>): AmmoLayout[] {
  const shells = setups.get("shellsSetups");
  const consumables = setups.get("eqsSetups");
  const count = Math.max(
    Array.isArray(shells) ? shells.length : 0,
    Array.isArray(consumables) ? consumables.length : 0,
  );
  const out: AmmoLayout[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      // Shells arrive as a flat run of pairs, each an int compact descriptor
      // followed by how many of them are loaded.
      shells: pairs(Array.isArray(shells) ? ints(shells[i]) : []),
      consumables: slots(
        Array.isArray(consumables) ? ints(consumables[i]) : [],
        ITEM_TYPE.equipment,
      ),
    });
  }
  return out;
}

/** The layouts of the devices-and-directives group. */
function deviceLayouts(setups: Map<unknown, unknown>): DevicesLayout[] {
  const devices = setups.get("devicesSetups");
  const boosters = setups.get("boostersSetups");
  const count = Math.max(
    Array.isArray(devices) ? devices.length : 0,
    Array.isArray(boosters) ? boosters.length : 0,
  );
  const out: DevicesLayout[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      optDevices: slots(
        Array.isArray(devices) ? ints(devices[i]) : [],
        ITEM_TYPE.optionalDevice,
      ),
      boosters: slots(
        Array.isArray(boosters) ? ints(boosters[i]) : [],
        ITEM_TYPE.equipment,
      ),
    });
  }
  return out;
}

/**
 * A run of slots, named, with an empty one kept as a null in place.
 *
 * The client writes a zero for a free slot, and position is meaning here: a
 * device's category and grade depend on which slot it sits in, so dropping the
 * holes would quietly renumber the ones after them.
 *
 * An item the catalogues do not know is NOT a null. The catalogues are
 * generated from an installed client, so a game patch that adds a device, or a
 * limited mode with equipment of its own, produces ids this does not hold. Null
 * for those would say "no device fitted", and a loadout of three would be
 * counted as a loadout of two by everything downstream -- the quietest possible
 * way to get the arithmetic wrong. So an unknown id keeps its number under a
 * prefix no real name can collide with: the slot is still plainly occupied, the
 * page shows the marker rather than a gap, and a count of them is how you know
 * the catalogue needs regenerating.
 */
export const UNKNOWN_ITEM = "unknown:";

function slots(values: number[], type: number): (string | null)[] {
  return values.map((intCD) => {
    if (!intCD) return null;
    const { type: kind, id } = splitIntCompactDescr(intCD);
    if (kind !== type) return `${UNKNOWN_ITEM}${intCD}`;
    const table = type === ITEM_TYPE.optionalDevice ? OPTIONAL_DEVICES : EQUIPMENTS;
    return table[id] ?? `${UNKNOWN_ITEM}${intCD}`;
  });
}

/** Shells, from the client's flat run of descriptor-and-count pairs. */
function pairs(values: number[]): LoadoutShell[] {
  const out: LoadoutShell[] = [];
  for (let i = 0; i + 1 < values.length; i += 2) {
    const intCD = values[i];
    const count = values[i + 1];
    if (!intCD) continue;
    const entry = SHELLS[intCD];
    // A round the catalogue does not know is kept, not skipped. Dropping it
    // lost the rounds themselves: `shellsLoaded` and the gold share are both
    // counted over this list, so one unknown round silently moved the premium
    // share of the whole rack.
    out.push({
      id: intCD,
      name: entry ? entry[0] : `${UNKNOWN_ITEM}${intCD}`,
      type: entry ? entry[1] : "UNKNOWN",
      premium: entry ? entry[2] === 1 : false,
      count,
    });
  }
  return out;
}

/** Which layout of a group is in use, defaulting to the first. */
function active(indexes: unknown, group: number): number {
  if (!(indexes instanceof Map)) return 0;
  const value = indexes.get(group);
  return typeof value === "number" && value >= 0 ? value : 0;
}

/* --------------------------------------------------------------- the packets */

/** Where a pickle sits in a property block, and what it decoded to. */
interface FoundPickle {
  /** The property index read back from in front of it. */
  index: number;
  /** The offset of its first byte, which is the `PROTO` opcode. */
  at: number;
  value: unknown;
}

/**
 * Every pickle in a property block, found by its own header.
 *
 * Found rather than walked. Walking the block would mean knowing the width of
 * every property in it, which is a table out of `Vehicle.def` that changes
 * whenever the client gains a property; a pickle announces itself with its
 * protocol header instead. The index is read back from the two bytes in front
 * of it and only accepted when the length there matches the length the pickle
 * actually decoded to, so a `80 02` that happens to fall inside some other
 * value is rejected rather than mistaken for a property.
 */
function pickles(body: Uint8Array): FoundPickle[] {
  const found: FoundPickle[] = [];
  for (let i = 2; i + 1 < body.length; i += 1) {
    if (body[i] !== 0x80 || body[i + 1] !== 0x02) continue;
    const read = readPickle(body, i);
    if (!read) continue;
    if (body[i - 1] !== read.length) continue;
    found.push({ index: body[i - 2], at: i, value: read.value });
  }
  return found;
}

/**
 * One life's loadout out of a `0x06` property block.
 *
 * The block is `[u32 entity][u32 length][u8 count]` and then the properties
 * themselves. Only two things are taken from it, and both are located by
 * shape: the pickles by their protocol header, and the crew by being the run
 * that ends exactly where the first of those pickles begins.
 */
function readBlock(body: Uint8Array, at: number): ReplayLoadout | null {
  if (body.length < 9) return null;
  const entityId = u32(body, 0);
  if (u32(body, 4) !== body.length - 8) return null;

  const found = pickles(body);
  if (found.length === 0) return null;

  // The setups name themselves, by the key they carry.
  const found_setups = found.find(
    (p) => p.value instanceof Map && p.value.has(SETUPS_KEY),
  );
  const setups = found_setups?.value;
  // Taken from AFTER the setups, not merely from anywhere in the block. The
  // client writes `enhancements` in the same property run, it is also a
  // dictionary with integer keys, and it sits in FRONT of the setups -- so
  // "the first integer-keyed dictionary" picks it whenever a player has any,
  // and the active layout then comes from a dictionary about something else.
  // The order is the client's own and is the thing to lean on here.
  const setupsAt = found_setups?.at;
  const indexes =
    setupsAt === undefined
      ? undefined
      : found.find(
          (p) =>
            p.at > setupsAt &&
            p.value instanceof Map &&
            p.value.size > 0 &&
            [...p.value.keys()].every((k) => typeof k === "number"),
        )?.value;

  let crew: LoadoutCrewMember[] | undefined;
  // The crew sits in front of every pickle in the block, so it has to end at
  // the index byte of the first of them, two in front of that pickle's header.
  // Every start is tried and only an exact landing is accepted: a crew read
  // from the wrong offset runs long or short almost at once, and each member's
  // descriptor has to begin with a tankman header on top of that, so the two
  // constraints together are far stronger than a property index would be.
  const first = found[0];
  const ends = first.at - 2;
  for (let from = 9; from < ends; from += 1) {
    const read = readCrewAt(body, from, ends);
    if (read) {
      crew = read;
      break;
    }
  }

  let groups: LoadoutSetups | undefined;
  if (setups instanceof Map) {
    const ammo = ammoLayouts(setups);
    const devices = deviceLayouts(setups);
    groups = {
      ...(ammo.length ? { ammo: { active: active(indexes, GROUP.ammo), layouts: ammo } } : {}),
      ...(devices.length
        ? { devices: { active: active(indexes, GROUP.devices), layouts: devices } }
        : {}),
    };
    if (!groups.ammo && !groups.devices) groups = undefined;
  }

  if (!crew && !groups) return null;
  return {
    entityId,
    at,
    ...(crew ? { crew } : {}),
    ...(groups ? { setups: groups } : {}),
  };
}

/**
 * Every loadout the recording player played, in the order they played them.
 *
 * One entry per life. A battle without respawns yields one; an Onslaught
 * battle yields one per tank taken out, each with its own crew, because the
 * client sends the whole property set again on every respawn.
 *
 * Blocks that carry neither a crew nor a setup are skipped rather than
 * returned empty: the same packet type also carries small property updates
 * during the battle, and an entry with nothing in it would read as a life with
 * an empty loadout.
 */
export function readLoadouts(stream: Uint8Array): ReplayLoadout[] {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const out: ReplayLoadout[] = [];
  let pos = 0;
  while (pos + 12 <= stream.length) {
    const length = view.getUint32(pos, true);
    const type = view.getUint32(pos + 4, true);
    if (pos + 12 + length > stream.length) break;
    if (type === 0x06) {
      const read = readBlock(stream.subarray(pos + 12, pos + 12 + length), view.getFloat32(pos + 8, true));
      if (read) out.push(read);
    }
    pos += 12 + length;
  }
  return out;
}

/**
 * The field modifications the header names, by vehicle.
 *
 * A different channel from everything else here, and a far richer one. The
 * fitted loadout comes off the packet stream and exists for one or two players;
 * `vehPostProgression` sits in the header's first JSON block, beside each
 * vehicle's name and type, and is there for every player who has any -- about
 * twelve or thirteen of the thirty in a real battle.
 *
 * Handed back packed. Turning these integers into "took the second side of
 * pair 3" needs the vehicle's own tree, which this layer has no business
 * fetching: the value is small, it never changes, and whoever draws it has the
 * trees already.
 */
export function readFieldMods(blocks: readonly unknown[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  const first = blocks[0] as { vehicles?: Record<string, unknown> } | null;
  for (const [id, vehicle] of Object.entries(first?.vehicles ?? {})) {
    const packed = (vehicle as { vehPostProgression?: unknown })
      ?.vehPostProgression;
    if (!Array.isArray(packed) || packed.length === 0) continue;
    const words = packed.filter((word): word is number => typeof word === "number");
    const key = Number(id);
    if (words.length && Number.isFinite(key)) out.set(key, words);
  }
  return out;
}
