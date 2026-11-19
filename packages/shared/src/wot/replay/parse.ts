import { Blowfish } from "./blowfish";
import { CHAT_COMMANDS } from "./chat-commands";

/**
 * Reading a `.wotreplay` the player chose, in their own browser.
 *
 * **Nothing is uploaded and nothing is stored.** A replay is 1.3 MB against
 * the 10 KB of results the mod sends, 94.8% of a seventeen-month corpus is
 * already unplayable because the client that recorded it has been patched
 * away, and a file is only there at all when the player left recording on.
 * Collecting them would be a storage decision with no way back; reading one in
 * the page is a feature with no cost at all, and it works for a battle nobody
 * shared.
 *
 * The format, in order:
 *
 *     12 32 34 11            magic
 *     u32                    how many JSON blocks follow
 *     u32 + bytes            each block, length-prefixed UTF-8 JSON
 *     u32                    the packet stream's size once inflated
 *     u32                    its size compressed
 *     bytes                  the stream, encrypted then deflated
 *
 * The first JSON block is the battle's own metadata (map, mode, roster, client
 * version); the second, when the battle finished, is the results the mod sends.
 * The stream after them is Blowfish ECB with a key the client ships, then one
 * XOR pass chaining each block against the previous PLAINTEXT, then deflate.
 */

/** The key the game ships in its own client. Not a secret, and not ours. */
const KEY = Uint8Array.from([
  0xde, 0x72, 0xbe, 0xa0, 0xde, 0x04, 0xbe, 0xb1, 0xde, 0xfe, 0xbe, 0xef, 0xde,
  0xad, 0xbe, 0xef,
]);

const MAGIC = [0x12, 0x32, 0x34, 0x11];

/** Refused rather than read: a file this large is not a replay. */
const MAX_FILE_BYTES = 256 * 1024 * 1024;
const MAX_INFLATED_BYTES = 512 * 1024 * 1024;

export class ReplayError extends Error {}

function u32(bytes: Uint8Array, at: number): number {
  return (
    (bytes[at] |
      (bytes[at + 1] << 8) |
      (bytes[at + 2] << 16) |
      (bytes[at + 3] << 24)) >>>
    0
  );
}

export type ReplayContainer = {
  /** The JSON blocks, already parsed. One before the battle, two after it. */
  blocks: unknown[];
  /** The packet stream, decrypted and inflated. Empty for an unfinished file. */
  stream: Uint8Array;
};

/** The JSON header of a replay, and where the packet stream starts after it. */
export type ReplayHeader = {
  blocks: unknown[];
  /**
   * The same blocks before `JSON.parse` touched them.
   *
   * Kept because the parsed form **loses the battle id**. `arenaUniqueID` is
   * nineteen digits, past `Number.MAX_SAFE_INTEGER`, so JSON.parse rounds
   * 90570953574329799 to 90570953574329800 and any comparison against the
   * real id fails for every battle. It is the same reason the column holding
   * it is `text`. Anything that needs the id reads it out of this.
   */
  texts: string[];
  /** Offset of the first byte past the last JSON block. */
  cursor: number;
};

/**
 * The battle id a replay names, as digits, or null.
 *
 * Read with a regex over the raw JSON rather than from a parsed object, for
 * the precision reason above. Every block after the first is searched: the
 * metadata block has no id, and which of the later ones carries it varies.
 */
export function battleIdIn(header: ReplayHeader): string | null {
  for (const text of header.texts.slice(1)) {
    const found = /"arenaUniqueID"\s*:\s*"?(\d{1,24})"?/.exec(text);
    if (found) return found[1];
  }
  return null;
}

/**
 * The accounts the results name, which is everyone who was in the battle.
 *
 * Searched in the block's own text rather than parsed out of it, for the
 * reason `battleIdIn` above does the same: a 60-player Frontline battle's
 * results are half a megabyte of JSON, and the only question asked of them
 * here is which accounts they name.
 *
 * Keyed on the field name, so a number that happens to equal an account id
 * somewhere else in the block cannot answer for it.
 */
export function accountsIn(header: ReplayHeader): Set<number> {
  const named = new Set<number>();
  for (const text of header.texts.slice(1)) {
    for (const found of text.matchAll(/"accountDBID"\s*:\s*"?(\d{1,20})"?/g)) {
      const id = Number(found[1]);
      if (Number.isSafeInteger(id) && id > 0) named.add(id);
    }
  }
  return named;
}

/**
 * The JSON blocks only, without touching the encrypted stream.
 *
 * Split out because the two readers want very different things. A viewer in
 * the browser wants the whole file. The server, handed an upload, only needs
 * to answer "is this a replay, and is it the battle it claims to be" before
 * putting a megabyte in a bucket, and decrypting 2 MB of packets to find that
 * out would be work done for nothing on every upload.
 */
export function readReplayHeader(file: Uint8Array): ReplayHeader {
  if (file.length > MAX_FILE_BYTES) {
    throw new ReplayError("That file is larger than any replay");
  }
  if (file.length < 12 || MAGIC.some((byte, i) => file[i] !== byte)) {
    throw new ReplayError("That is not a World of Tanks replay");
  }
  const count = u32(file, 4);
  if (count > 16) throw new ReplayError("That replay's header is not readable");

  const blocks: unknown[] = [];
  const texts: string[] = [];
  let cursor = 8;
  for (let i = 0; i < count; i += 1) {
    const size = u32(file, cursor);
    cursor += 4;
    if (cursor + size > file.length) {
      throw new ReplayError("That replay is truncated");
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(
      file.subarray(cursor, cursor + size),
    );
    cursor += size;
    texts.push(text);
    try {
      blocks.push(JSON.parse(text));
    } catch {
      // One unreadable block is not worth the file: the metadata block is the
      // one that matters, and a later one can be a shape we have not met.
      blocks.push(null);
    }
  }
  return { blocks, texts, cursor };
}

/** Split a replay into its JSON blocks and its packet stream. */
export async function readReplay(file: Uint8Array): Promise<ReplayContainer> {
  const { blocks, cursor: start } = readReplayHeader(file);
  let cursor = start;

  // A replay of a battle still being played has no stream yet.
  if (cursor + 8 > file.length) return { blocks, stream: new Uint8Array() };
  const inflatedSize = u32(file, cursor);
  const compressedSize = u32(file, cursor + 4);
  cursor += 8;
  if (inflatedSize > MAX_INFLATED_BYTES) {
    throw new ReplayError("That replay's packet stream is implausibly large");
  }

  const encrypted = file.subarray(cursor);
  const decrypted = new Blowfish(KEY).decryptEcb(encrypted);

  // Each plaintext block is XORed with the one before it, starting from zero.
  // The previous PLAINTEXT, not the previous ciphertext: against the
  // ciphertext the stream decrypts to something that looks like data and
  // inflates to nothing.
  const chained = new Uint8Array(decrypted.length);
  const previous = new Uint8Array(8);
  for (let offset = 0; offset < decrypted.length; offset += 8) {
    const width = Math.min(8, decrypted.length - offset);
    for (let i = 0; i < width; i += 1) {
      chained[offset + i] = decrypted[offset + i] ^ previous[i];
    }
    previous.set(chained.subarray(offset, offset + width));
  }

  const stream = await inflate(chained.subarray(0, compressedSize));
  return { blocks, stream };
}

/** Deflate, through the platform's own decompressor. */
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "function") {
    throw new ReplayError("This browser cannot decompress a replay");
  }
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

/** One vehicle's path through the battle, in the arena's own metres. */
export type Track = {
  /** The battle-scoped vehicle id, the same one the results are keyed by. */
  id: number;
  /** `[seconds, x, y, z]`, in order, with repeats dropped. */
  points: [number, number, number, number][];
  /** The hull's last heading in radians, or null when none was reported. */
  heading: number | null;
  /**
   * The hull's heading over time, `[seconds, radians]`, one entry per change.
   * Radians from north (+z) towards east (+x), the frame the positions use,
   * so a vehicle driving straight has the heading of its own path.
   */
  hull: [number, number][];
  /**
   * Where the gun points over time, `[seconds, radians]`: the turret's angle
   * RELATIVE TO THE HULL, from the vehicle's `gunAnglesPacked` property (ten
   * bits of yaw, decoded as the client's own `decodeGunAngles` does). The
   * absolute direction is the hull's heading at the same moment plus this.
   * Empty for a vehicle the recording never saw aim.
   */
  turret: [number, number][];
};

/** One vehicle's health as the recording client was told it, over time. */
export type HealthTrack = {
  id: number;
  /** `[seconds, hit points]`, in order, one entry per change. */
  points: [number, number][];
};

/** One line somebody typed in the battle, as the client recorded it. */
export type ChatLine = {
  /** Seconds on the replay's own clock, the same one the positions use. */
  at: number;
  /** Who typed it, with their clan tag if they had one, as the game wrote it. */
  from: string;
  /** The vehicle they were in, or null when the line carries none. */
  vehicle: string | null;
  /** What they typed, with the game's HTML entities resolved. Never markup. */
  text: string;
  /** The colour the game gave the line, which is how it says ally or enemy. */
  colour: string | null;
  /**
   * The quick command this line IS, when it is one rather than something typed.
   *
   * A reload callout, a map ping, "Help!": the game sends those as an action
   * id on another packet entirely. This is the client's own `msgText` key, the
   * one `game/chat-commands` files the sentence under in every language.
   * Absent for a line somebody actually typed.
   */
  command?: string;
  /**
   * Where on the map a ping was put, in the arena's own metres, or null.
   *
   * `strArg2`, twelve bytes when the command carries a place: three
   * little-endian floats, x, height, z, in the frame the positions use. The
   * height is read and dropped, as everywhere else here, because a minimap is a
   * plan view. Null for a command that pings nothing, where the field is empty.
   */
  where?: { x: number; z: number } | null;
  /** The vehicle a command is ABOUT, when it is about one. `int32Arg1`. */
  target?: number | null;
  /** Seconds left on a reload, for the callouts that say so. `floatArg1`. */
  reloadTime?: number | null;
  /** A base or objective label the message names. `strArg1`. */
  label?: string | null;
  /**
   * Who sent a command, as an id to match against the battle's own vehicles.
   *
   * `int64Arg1`. On a real recording it came back as the sender's VEHICLE id,
   * the same id the tracks are keyed by, which is what makes it resolvable at
   * all. Not for every command though: a waypoint's ran to nineteen digits and
   * is plainly something else. So it is handed over unresolved and shown only
   * where it names somebody who was there.
   */
  sender?: number | null;
};

/** One vehicle finishing another, as the recording client heard it. */
export type Kill = {
  /** Seconds on the replay's own clock. */
  at: number;
  /** The vehicle that died, keyed like the tracks. */
  victim: number;
  /** Who finished it, or null when nobody did: fire, drowning, a fall. */
  by: number | null;
  /** The hit points the killing blow took, which is what it was worth. */
  damage: number;
};

/** One shot that took hit points off a vehicle, as the recording client heard it. */
export type Hit = {
  /** Seconds on the replay's own clock. */
  at: number;
  /** The vehicle that lost the hit points, keyed like the tracks. */
  victim: number;
  /** Who did it. Damage with no author (fire, a fall, drowning) is not a hit. */
  by: number;
  /** The hit points it took. */
  damage: number;
  /** Whether it was the last shot. */
  fatal: boolean;
};

/**
 * One shell the recording client saw fired: where it left, where it landed
 * when that is known, and whether it hit a vehicle.
 */
export type Shot = {
  /** Seconds on the replay's clock when it was fired. */
  at: number;
  /** The vehicle that fired, keyed like the tracks. */
  by: number;
  /** The muzzle, in the arena's metres. */
  from: { x: number; z: number };
  /** Where it ended, or null when the client never saw it land. */
  to: { x: number; z: number } | null;
  /** When it ended, or null with `to`. */
  endAt: number | null;
  /** Its heading from north towards east, so one with no end still points. */
  heading: number;
  /** The vehicle it struck, when it struck one. */
  victim: number | null;
  /** A ricochet the game drew as its own tracer. */
  ricochet: boolean;
};

export type ReplayMotion = {
  tracks: Track[];
  /**
   * Every shell the recording client saw fired, from the avatar's own
   * `showTracer` (the muzzle and the velocity) matched by shot id to its
   * `explodeProjectile` (the point it burst on the ground or the scenery).
   * A shell that struck a vehicle bursts through the vehicle's own damage
   * event instead, so it ends on the vehicle it hit; one the client lost
   * sight of keeps its heading and no end.
   */
  shots: Shot[];
  /**
   * Health over time, for the vehicles the stream reports it for.
   *
   * The layout of the packet that carries this is not something to be found
   * by probing offsets, and was not: it is documented by the open decoder at
   * replay.wot-tools.dev, whose reading of it is followed here. Guessing had
   * already produced a plausible field that was in fact `method`.
   */
  health: HealthTrack[];
  /** How long the stream runs, in seconds. */
  duration: number;
  /** Every line typed in the battle, in the order they were sent. */
  chat: ChatLine[];
  /**
   * Every kill this client heard about, in order.
   *
   * Heard about, not every kill there was: health only reaches a client for a
   * vehicle it can see, so a tank finished out of sight leaves no event here
   * even though the battle's own results know it died. The same fog of war the
   * positions have, and the reason the results stay the authority on WHO died.
   */
  kills: Kill[];
  /**
   * Every authored hit this client heard about, in order.
   *
   * The same health packets the kills come from, each one carrying the shot's
   * author, so it says who dealt damage when. Heard about under the same fog of
   * war: a vehicle the recording side cannot see does not report its health.
   */
  hits: Hit[];
  /**
   * The recorder's rack and consumables over time (`OwnVehicle.vehicleAmmoList`):
   * one entry per change, keyed by the item's compact descriptor (a shell when
   * `compactDescr & 0xf` is 10, a consumable at 11). For a consumable the
   * quantity is 65535 while unused and one less per use.
   */
  ammo: { at: number; item: number; quantity: number }[];
  /**
   * The recorder's own modules and crew (`OwnVehicle.vehicleDamageInfoList`):
   * the vehicle extra hit (61 engine ... 77 second loader, the order of the
   * client's `vehicle.xml` extras) and the `DAMAGE_INFO_CODES` index saying how.
   */
  ownDamage: { at: number; extra: number; code: number }[];
  /**
   * The recorder's battle feed (`OwnVehicle.onBattleEvents`): type
   * (`BATTLE_EVENT_TYPE`), target, and the amount it carries (damage, assist,
   * blocked) or the number of critical hits. Events on a target the client
   * cannot see are never sent, so the damage can fall short of the results.
   */
  events: { at: number; type: number; target: number; amount: number; crits: number }[];
  /**
   * Another vehicle's modules and crew as the recorder's commander could see
   * them (`Avatar.showOtherVehicleDamagedDevices`): only for the vehicle under
   * their crosshair, and only with the skill that shows them. A vehicle of 0
   * is "no target any more".
   */
  targetDamage: { at: number; vehicle: number; damaged: number[]; destroyed: number[] }[];
  /**
   * The recorder's own view range over time, `[seconds, metres]`, exactly as
   * the server sent it (`OwnVehicle.syncVehicleAttrs.circularVisionRadius`):
   * crew, devices, directives and the binoculars all included, uncapped. The
   * game's minimap draws `min(value, 445)`. Empty for a stream that does not
   * carry it. Only the recorder's, since the component exists on the player's
   * own vehicle alone.
   */
  vision: [number, number][];
  /**
   * When the recorder was spotted, in seconds: the game's sixth sense, one
   * entry per time the server told them (`OwnVehicle.onObservedByEnemy`). The
   * lamp has no "unspotted" signal; the client lights it for two seconds
   * (`GUI_SETTINGS.sixthSenseDuration`) each time.
   */
  observed: number[];
  /**
   * Where the vehicles past the recorder's 565 m were, as their minimap draws
   * them: every two seconds, for each ally and each enemy the team has spotted
   * (the client's `VEHICLE_LOCATION.FAR`). Keyed by the arena's own vehicle
   * index rather than the id, which the caller resolves (see `minimapIndex`).
   * Metres, rounded by the server. Sent only when the position changes (not
   * one repeat in 1,794 measured), so silence is a vehicle standing still;
   * the team losing it is said outright, as `FAR_LOST` on both axes.
   */
  minimap: { at: number; key: number; x: number; z: number }[];
  /** Every packet type seen and how often, which is what makes a gap findable. */
  seen: Record<number, number>;
};

/**
 * The packet stream, walked for where everybody was.
 *
 * A packet is `[u32 payload size][u32 type][f32 clock][payload]`, and the one
 * that matters here carries a vehicle id and a position. Types we do not read
 * are counted rather than skipped silently: a replay from a client we have not
 * met will show up as a type nobody handled, which is a thing to look at
 * rather than an empty map.
 *
 * The clock is sanity-checked because a misaligned walk produces float noise
 * rather than an error, and an eight-hour battle is the clearest sign of it.
 */
const CHAT_DECODER = new TextDecoder("utf-8", { fatal: false });

/**
 * One chat line out of a `0x23` packet, or null when it is not one we can read.
 *
 * The packet is `[u32 length][utf8]`, and the string the game stores is already
 * marked up, which is a gift and a trap in equal measure:
 *
 *     <font color='#80D63A'>Finder30 (Pz. 55)&nbsp;: </font>
 *     <font color='#80D63A'>j&apos;arrive</font>
 *
 * The gift is that the sender, the clan tag, the vehicle and the side's colour
 * are all there with no cross-referencing. The trap is that it is markup
 * carrying text a player typed, so it is taken APART here and handed on as
 * plain strings. Nothing downstream is ever given the markup to render, and
 * nothing here passes a player's own characters through as HTML.
 *
 * Verified against four real replays of this client: two carried lines, two
 * carried the packet type not at all, which is simply a battle nobody spoke in.
 */
const ACTION_NAME = "bw_chat2.onActionReceived";

/** The game's own cooldown for sending the same command again, in seconds. */
const COMMAND_REPEAT = 5;

/**
 * One quick command out of a `0x31` packet, or null when it is not one.
 *
 * The packet is `[u32 nameLen][method name][u32 bodyLen][python pickle]`, and
 * only one method name matters. The pickle is protocol 2 and the client's own
 * `FixedDict`, which is more than is needed here: the id is the FIRST integer
 * after the two-byte header, verified on three real packets, one of which
 * resolved to the waypoint command while also spelling out `prebattlemarker`
 * in its own payload. The sender is `int64Arg1`, found by its key rather than
 * by an offset, because the dict's order is the client's business and not ours.
 *
 * No general pickle reader, deliberately: two fields are wanted, and a reader
 * that interprets a pickle is a reader that interprets whatever a file holds.
 */
function readCommand(
  stream: Uint8Array,
  at: number,
  from: number,
  to: number,
): ChatLine | null {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  if (to - from < 8) return null;
  const nameLength = view.getUint32(from, true);
  if (nameLength !== ACTION_NAME.length || from + 8 + nameLength > to) return null;
  if (
    CHAT_DECODER.decode(stream.subarray(from + 4, from + 4 + nameLength)) !==
    ACTION_NAME
  ) {
    return null;
  }
  const body = from + 8 + nameLength;
  // The pickle's own header, then the id as a one-byte int.
  if (body + 4 > to || stream[body] !== 0x80 || stream[body + 1] !== 0x02) return null;
  if (stream[body + 2] !== 0x4b) return null;
  const command = CHAT_COMMANDS[stream[body + 3]];
  // An id outside the table is one of the commands with no words of its own: a
  // reply, a cancel, a marker-only ping. Nothing was said, so nothing is kept.
  if (!command) return null;

  return {
    at,
    from: "",
    vehicle: null,
    // The English, as the fallback. The sentence a reader actually sees is
    // looked up from `game/chat-commands` under the key below, in the words
    // their own client would have used.
    text: command.english,
    colour: null,
    command: command.key,
    // Handed over as a number for the caller to match against the battle's own
    // participants, and shown only if it matches one. It is `int64Arg1`, which
    // is an account id for some commands and something else entirely for
    // others: a waypoint's was nineteen digits, past what a JavaScript number
    // holds exactly. Resolving it against a list of people who were actually
    // there is the only check worth having, so the check is where that list is.
    sender: senderOf(stream, body, to),
    where: placeOf(stream, body, to),
    // What the message's own placeholders need. `int32Arg1` is the TARGET
    // (`getFirstTargetID`) against `int64Arg1` for the sender
    // (`getSenderVehID`): two fields that are easy to swap, and the client
    // names them plainly, so they were read there rather than inferred.
    target: numberOr(argOf(stream, body, to, "int32Arg1")),
    reloadTime: numberOr(argOf(stream, body, to, "floatArg1")),
    label: stringOr(argOf(stream, body, to, "strArg1")),
  };
}

/**
 * One value out of the pickled dict, found by its key rather than by an offset.
 *
 * The client's `FixedDict` orders itself as it pleases, so the keys are the only
 * stable thing. Six opcodes are read and no more: this is not a pickle
 * interpreter, and a reader that interprets a pickle interprets whatever a file
 * happens to hold.
 */
function argOf(
  stream: Uint8Array,
  from: number,
  to: number,
  key: string,
): number | string | null {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  for (let at = from; at + key.length + 2 < to; at += 1) {
    if (stream[at] !== key.charCodeAt(0)) continue;
    if (CHAT_DECODER.decode(stream.subarray(at, at + key.length)) !== key) continue;
    const value = at + key.length;
    const code = stream[value];
    // BININT1 and BININT2, what a small number pickles as.
    if (code === 0x4b) return stream[value + 1];
    if (code === 0x4d) return view.getUint16(value + 1, true);
    // BININT4, signed, what a vehicle id pickles as.
    if (code === 0x4a) return value + 5 > to ? null : view.getInt32(value + 1, true);
    // LONG1: a length byte, then that many bytes, little-endian.
    if (code === 0x8a) {
      const length = stream[value + 1];
      if (length === 0 || value + 2 + length > to) return null;
      let out = 0;
      for (let byte = length - 1; byte >= 0; byte -= 1) {
        out = out * 256 + stream[value + 2 + byte];
      }
      return out;
    }
    // BINFLOAT, eight bytes BIG-endian, which is the one that is not.
    if (code === 0x47) return value + 9 > to ? null : view.getFloat64(value + 1, false);
    // SHORT_BINSTRING.
    if (code === 0x55) {
      const length = stream[value + 1];
      if (value + 2 + length > to) return null;
      return CHAT_DECODER.decode(stream.subarray(value + 2, value + 2 + length));
    }
    return null;
  }
  return null;
}

/** Narrowing, so one reader can serve fields of three different types. */
function numberOr(value: number | string | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOr(value: number | string | null): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * `strArg2` as a place on the map, or null when the command carries none.
 *
 * Twelve bytes, three floats, x height z. The length is CHECKED rather than
 * assumed: the same field is empty on a command that pings nothing, and reading
 * four bytes of nothing as a coordinate would put a marker at a plausible
 * looking place nobody chose.
 */
function placeOf(
  stream: Uint8Array,
  from: number,
  to: number,
): { x: number; z: number } | null {
  const key = "strArg2";
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  for (let at = from; at + key.length + 2 < to; at += 1) {
    if (stream[at] !== 0x73) continue;
    if (CHAT_DECODER.decode(stream.subarray(at, at + key.length)) !== key) continue;
    const value = at + key.length;
    // SHORT_BINSTRING: the opcode, one length byte, then the bytes.
    if (stream[value] !== 0x55 || stream[value + 1] !== 12) return null;
    if (value + 14 > to) return null;
    const x = view.getFloat32(value + 2, true);
    const z = view.getFloat32(value + 10, true);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    return { x, z };
  }
  return null;
}

/** `int64Arg1` out of the pickle, found by its key. Null when it is not there. */
function senderOf(stream: Uint8Array, from: number, to: number): number | null {
  const key = "int64Arg1";
  for (let at = from; at + key.length + 2 < to; at += 1) {
    if (stream[at] !== 0x69) continue;
    if (CHAT_DECODER.decode(stream.subarray(at, at + key.length)) !== key) continue;
    const value = at + key.length;
    // LONG1: one length byte, then that many bytes, little-endian.
    if (stream[value] === 0x8a) {
      const length = stream[value + 1];
      if (length === 0 || value + 2 + length > to) return null;
      let out = 0;
      for (let byte = length - 1; byte >= 0; byte -= 1) {
        out = out * 256 + stream[value + 2 + byte];
      }
      return out;
    }
    if (stream[value] === 0x4b) return stream[value + 1];
    return null;
  }
  return null;
}

function readChatLine(
  stream: Uint8Array,
  at: number,
  from: number,
  to: number,
): ChatLine | null {
  if (to - from < 5) return null;
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const length = view.getUint32(from, true);
  // Bounded by the packet itself rather than trusted: a length that overruns
  // is a misread walk, not a long message.
  if (length === 0 || length > to - from - 4) return null;
  const raw = CHAT_DECODER.decode(stream.subarray(from + 4, from + 4 + length));

  // `[^]` rather than `.` with the `s` flag, which this project's target does
  // not reach. Same thing: anything including a newline, and a message can
  // carry one.
  const spans = [
    ...raw.matchAll(/<font[^>]*color='([^']*)'[^>]*>([^]*?)<\/font>/g),
  ];
  if (spans.length < 2) return null;
  const head = entities(spans[0][2]).trim();
  const text = entities(spans.slice(1).map((span) => span[2]).join("")).trim();
  if (!text) return null;

  // "Nickname[CLAN] (Vehicle) :" is the shape, and the vehicle is the one part
  // that may be absent. Taken from the LAST parentheses, since a nickname is
  // allowed to contain them and the vehicle is always final.
  const vehicle = head.match(/\(([^()]*)\)\s*:?\s*$/);
  const from_ = head
    .replace(/\(([^()]*)\)\s*:?\s*$/, "")
    .replace(/[\s:]+$/, "")
    .trim();
  return {
    at,
    from: from_ || head,
    vehicle: vehicle ? vehicle[1].trim() : null,
    text,
    colour: spans[0][1] || null,
  };
}

/** The five entities the game writes, and nothing else: this is not an HTML parser. */
function entities(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** The smallest hull turn worth keeping, in radians: about a degree. */
const HEADING_STEP = 0.0175;

export function readMotion(stream: Uint8Array): ReplayMotion {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const byVehicle = new Map<number, [number, number, number, number][]>();
  const health = new Map<number, [number, number][]>();
  const chat: ChatLine[] = [];
  const kills: Kill[] = [];
  const hits: Hit[] = [];
  const commandAt = new Map<string, number>();
  const headings = new Map<number, number>();
  const hulls = new Map<number, [number, number][]>();
  // Every two-byte property update, by property then vehicle: the gun angles
  // are one of them, and which index they sit at is the order of the entity's
  // own definition, which a game update can shift. So the index is not
  // assumed: the busiest two-byte property is the gun, by a wide margin (it
  // is sent every tick a turret moves; 18,272 updates against 3,864 for the
  // next one on a real battle).
  const shortProps = new Map<number, Map<number, [number, number][]>>();
  // Every fixed fifty-byte method call, and every one of forty bytes and up,
  // by method index: the tracer and the burst are among them, and which index
  // each holds is the entity definition's order, which an update can shift.
  // They are told apart afterwards by what they carry (see below).
  const fifty = new Map<number, { at: number; offset: number }[]>();
  const bursts = new Map<number, { at: number; offset: number }[]>();
  const seen: Record<number, number> = {};
  const ammo: { at: number; item: number; quantity: number }[] = [];
  const ownDamage: { at: number; extra: number; code: number }[] = [];
  // Feed events by the record id that carried them: the one carrying most is
  // the battle feed (see the walk below).
  const feeds = new Map<number, { at: number; type: number; target: number; amount: number; crits: number }[]>();
  // Calls of the shape `[vehicle u32][n][n extras][m][m extras]`, by entity
  // and method: the pair carrying most is the commander's view of the target.
  const sights = new Map<string, { at: number; vehicle: number; damaged: number[]; destroyed: number[] }[]>();
  const vision: [number, number][] = [];
  // The component's message ids are assigned per battle and again on every
  // respawn, so the sixth sense is read off the attrs it sits beside: its id is
  // the attrs' base plus 23. Candidates are kept until the walk has seen every
  // base, because the attrs may first change long after the first spotting.
  const bases = new Set<number>();
  const lamps: { at: number; id: number; kind: number }[] = [];
  const minimap: { at: number; comp: number; key: number; x: number; z: number }[] = [];
  // Every vehicle entering the recorder's area, `[clock, body start, end]`:
  // its creation carries the gun's angle at that moment, which the property
  // updates only repeat once the turret moves (see below).
  const entries: { at: number; from: number; to: number }[] = [];
  let duration = 0;
  let cursor = 0;

  while (cursor + 12 <= stream.length) {
    const payloadSize = u32(stream, cursor);
    const packetSize = payloadSize + 12;
    if (packetSize < 12 || cursor + packetSize > stream.length) break;
    const type = u32(stream, cursor + 4);
    const clock = view.getFloat32(cursor + 8, true);
    cursor += packetSize;
    if (type === 0xffffffff) break;
    seen[type] = (seen[type] ?? 0) + 1;
    // A battle runs under half an hour, and the clock starts slightly negative
    // while the countdown runs. Anything outside that is a misread walk.
    if (!Number.isFinite(clock) || clock < -120 || clock > 28800) continue;
    if (clock > duration) duration = clock;

    // Position. The vehicle id sits at the payload's start and the three
    // coordinates eight bytes further in, NOT straight after it: reading them
    // adjacent gives an x of zero on every vehicle of every battle, which is
    // the kind of wrong that draws a map rather than failing.
    if (type === 0x0a && packetSize >= 32) {
      const packet = cursor - packetSize;
      const id = u32(stream, packet + 12);
      const x = view.getFloat32(packet + 20, true);
      const y = view.getFloat32(packet + 24, true);
      const z = view.getFloat32(packet + 28, true);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        continue;
      }
      // An arena is about a kilometre across. This is not a bound on the map,
      // it is the floor noise a misaligned walk produces, and it keeps one bad
      // packet from stretching the whole drawing.
      if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > 100000) continue;
      // Where the hull is pointing, when the packet is long enough to carry
      // it: a track without it draws a dot moving, with it a tank facing.
      if (packetSize >= 48) {
        const heading = view.getFloat32(cursor - packetSize + 44, true);
        if (Number.isFinite(heading) && Math.abs(heading) <= Math.PI * 8) {
          headings.set(id, heading);
          const series = hulls.get(id) ?? [];
          const last = series.at(-1);
          // A turn of a degree is the finest a 2D marker can show.
          if (!last || Math.abs(last[1] - heading) > HEADING_STEP) {
            series.push([clock, heading]);
            hulls.set(id, series);
          }
        }
      }
      const points = byVehicle.get(id) ?? [];
      const last = points.at(-1);
      // A vehicle that has not moved writes the same position every tick, and
      // a battle is twenty minutes of them: keeping only the changes is what
      // makes the track small enough to draw.
      if (!last || last[1] !== x || last[2] !== y || last[3] !== z) {
        points.push([clock, x, y, z]);
        byVehicle.set(id, points);
      }
    }

    // A vehicle's own methods, of which exactly one is wanted here.
    //
    //     id      u32 at +12
    //     method  u32 at +16
    //     size    u32 at +20
    //     body         at +24
    //
    // Method 4 with a ten-byte body is the health change: the new value, the
    // one before it, and who caused it. Both checks matter, because method 1
    // is a shot and sits in the same packet type; reading the body without
    // them yields numbers that look like health and are not.
    if (type === 0x08 && packetSize >= 24) {
      const packet = cursor - packetSize;
      const id = u32(stream, packet + 12);
      const method = u32(stream, packet + 16);
      const size = u32(stream, packet + 20);
      if (method === 4 && size === 10 && packet + 34 <= stream.length) {
        const hp = view.getInt16(packet + 24, true);
        const was = view.getInt16(packet + 26, true);
        // Who did it, the third field of the same body. Zero for damage with
        // no author: fire, drowning, falling, the end-of-battle wipe.
        const by = u32(stream, packet + 28);
        if (hp >= 0 && hp < 100000) {
          const series = health.get(id) ?? [];
          const previous = series.at(-1);
          if (!previous || previous[1] !== hp) {
            series.push([clock, hp]);
            health.set(id, series);
          }
          // The shot that finished somebody, kept apart from the health series
          // because it is an event and not a sample: a reader wants "who killed
          // whom, when", and that is not derivable from two curves.
          if (hp === 0 && was > 0) {
            kills.push({ at: clock, victim: id, by: by || null, damage: was });
          }
          if (by && was > hp) {
            hits.push({
              at: clock,
              victim: id,
              by,
              damage: was - hp,
              fatal: hp === 0,
            });
          }
        }
      }
    }

    // A vehicle property changing: id, property index, size, then the value.
    if (type === 0x07 && packetSize >= 26) {
      const packet = cursor - packetSize;
      if (u32(stream, packet + 20) === 2) {
        const id = u32(stream, packet + 12);
        const property = u32(stream, packet + 16);
        const code = view.getUint16(packet + 24, true);
        const byId = shortProps.get(property) ?? new Map<number, [number, number][]>();
        const series = byId.get(id) ?? [];
        if (series.at(-1)?.[1] !== code) series.push([clock, code]);
        byId.set(id, series);
        shortProps.set(property, byId);
      }
    }

    if (type === 0x08 && packetSize >= 30) {
      const packet = cursor - packetSize;
      const length = u32(stream, packet + 20);
      const body = packet + 24;
      if (body + length <= cursor && length >= 6) {
        const n = stream[body + 4];
        const m = body + 5 + n < cursor ? stream[body + 5 + n] : -1;
        const extras = [...stream.subarray(body + 5, body + 5 + n), ...stream.subarray(body + 6 + n, body + length)];
        if (m >= 0 && 6 + n + m === length && extras.every((extra) => extra > 0 && extra < 200)) {
          const key = `${u32(stream, packet + 12)}:${u32(stream, packet + 16)}`;
          const list = sights.get(key) ?? [];
          list.push({
            at: clock,
            vehicle: u32(stream, body),
            damaged: [...stream.subarray(body + 5, body + 5 + n)],
            destroyed: [...stream.subarray(body + 6 + n, body + length)],
          });
          sights.set(key, list);
        }
      }
    }

    if (type === 0x08 && packetSize >= 24) {
      const packet = cursor - packetSize;
      const method = u32(stream, packet + 16);
      const size = u32(stream, packet + 20);
      if (size === 50 && packet + 74 <= stream.length) {
        const list = fifty.get(method) ?? [];
        list.push({ at: clock, offset: packet + 24 });
        fifty.set(method, list);
      } else if (size >= 41 && size <= 400 && packet + 24 + size <= stream.length) {
        const list = bursts.get(method) ?? [];
        list.push({ at: clock, offset: packet + 24 });
        bursts.set(method, list);
      }
    }

    // The recorder's view range, inside the batches of component messages:
    // created in 0x32, changed in 0x37.
    if (type === 0x32 || type === 0x37) {
      const found = readVisionRadius(stream, view, cursor - packetSize + 12, cursor, type === 0x37);
      if (found) {
        if (found.base !== null) bases.add(found.base);
        if (vision.at(-1)?.[1] !== found.radius) vision.push([clock, found.radius]);
      }
    }
    if (type === 0x05 && packetSize > 60) {
      entries.push({ at: clock, from: cursor - packetSize + 12, to: cursor });
    }

    // The minimap's far positions, `[id u16 BE][02][06][key u16][x i16][z i16]`
    // inside the same batches, the key's top six bits `100101` and its low ten
    // the vehicle's index (it overflows into the second byte past 0xff, so it
    // is read as one number). Which component id carries them is settled once
    // the walk is over, as the one carrying most of them.
    if (type === 0x37) {
      for (let at = cursor - packetSize + 16; at + 10 <= cursor; at += 1) {
        if (stream[at + 2] !== 0x02 || stream[at + 3] !== 0x06) continue;
        const key = view.getUint16(at + 4, true);
        if ((key & 0xfc00) !== 0x9400) continue;
        // Kept as they come, the server's "no position" included: the lowest
        // int16 on both axes (`FAR_LOST`), a vehicle the team just lost.
        minimap.push({
          at: clock,
          comp: (stream[at] << 8) | stream[at + 1],
          key: key & 0x3ff,
          x: view.getInt16(at + 6, true),
          z: view.getInt16(at + 8, true),
        });
      }
    }
    // The recorder's rack, modules and battle feed, in the same batches. Each
    // is recognised by its shape, since the record ids move between battles
    // and do not follow the component's own definition.
    if (type === 0x37 || type === 0x32) {
      const from = cursor - packetSize + 16;
      for (let at = from; at + 4 <= cursor; at += 1) {
        const flags = stream[at + 2];
        const length = stream[at + 3];
        // `vehicleAmmoList` entry: twenty bytes behind a three-byte path
        // starting 0x84 or 0x85.
        if ((flags === 1 || flags === 2) && length === 0x14 && at + 24 <= cursor && (stream[at + 4] & 0xfe) === 0x84) {
          const item = view.getInt32(at + 7, true);
          if ((item & 0xf) === 10 || (item & 0xf) === 11) {
            ammo.push({ at: clock, item, quantity: view.getUint16(at + 11, true) });
          }
        }
        // `vehicleDamageInfoList` entry: eleven bytes behind the path 98 01.
        if ((flags === 1 || flags === 2) && length === 0x0b && at + 15 <= cursor && stream[at + 4] === 0x98 && stream[at + 5] === 0x01) {
          const extra = stream[at + 6];
          const code = stream[at + 7];
          if (extra > 0 && extra < 200 && code < 40) ownDamage.push({ at: clock, extra, code });
        }
      }
      // `onBattleEvents`: `[id u16][n]` then n sixteen-byte events, each
      // `[01][type][target u32][details u64][count u16]`.
      for (let at = from; at + 19 <= cursor; at += 1) {
        const n = stream[at + 2];
        if (n < 1 || n > 40 || at + 3 + 16 * n > cursor) continue;
        let fits = true;
        for (let i = 0; i < n && fits; i += 1) {
          const event = at + 3 + 16 * i;
          fits = stream[event] === 1 && stream[event + 1] <= 24;
        }
        if (!fits) continue;
        const id = (stream[at] << 8) | stream[at + 1];
        const list = feeds.get(id) ?? [];
        for (let i = 0; i < n; i += 1) {
          const event = at + 3 + 16 * i;
          const details = view.getBigUint64(event + 6, true);
          list.push({
            at: clock,
            type: stream[event + 1],
            target: u32(stream, event + 2),
            amount: Number((details >> BigInt(25)) & BigInt(0xffff)),
            crits: Number((details >> BigInt(24)) & BigInt(0xffff)),
          });
        }
        feeds.set(id, list);
        at += 2 + 16 * n;
      }
    }

    // Every one-byte component message, `[id u16 BE][00][01][value]`: the
    // shape the sixth sense arrives in, usually alone in its batch but not
    // always. Which of them it is gets settled once the walk is over.
    if (type === 0x37) {
      for (let at = cursor - packetSize + 16; at + 5 <= cursor; at += 1) {
        if (stream[at + 2] !== 0x00 || stream[at + 3] !== 0x01) continue;
        lamps.push({ at: clock, id: (stream[at] << 8) | stream[at + 1], kind: stream[at + 4] });
      }
    }

    // Everything somebody typed. Last of the three because it is the rarest:
    // two of four real battles carried none at all.
    if (type === 0x23) {
      const packet = cursor - packetSize;
      const line = readChatLine(stream, clock, packet + 12, cursor);
      if (line) chat.push(line);
    }

    // And the quick commands, a different packet carrying a number rather than
    // a sentence. Into the same list, because a reader wants one record of what
    // was said and does not care which wire each line came down.
    if (type === 0x31) {
      const packet = cursor - packetSize;
      const line = readCommand(stream, clock, packet + 12, cursor);
      // Folded, because a held marker re-sends itself two or three times a
      // second: one real battle produced a hundred and sixty-nine of these for
      // what a player would call four or five callouts. The window is the
      // game's own cooldown for repeating a command, five seconds, so this
      // collapses exactly what the game would not have let anyone send twice.
      if (line) {
        const seen = `${line.command}:${line.sender ?? "?"}`;
        const last = commandAt.get(seen);
        if (last === undefined || clock - last > COMMAND_REPEAT) {
          commandAt.set(seen, clock);
          chat.push(line);
        }
      }
    }
  }

  let gun = new Map<number, [number, number][]>();
  let gunIndex = -1;
  let busiest = 0;
  for (const [property, byId] of shortProps) {
    let total = 0;
    for (const series of byId.values()) total += series.length;
    if (total > busiest) {
      busiest = total;
      gun = byId;
      gunIndex = property;
    }
  }
  // The angle a vehicle entered with. The update only comes once the turret
  // turns, so a tank that rolled into range with its gun already laid had no
  // aim for seconds (three on a real battle, through the moment it fired).
  // The creation lists its properties as `[index u8][value]`, and the gun's is
  // found between its neighbours, `[gun][u16][gun + 1]`, past the 44 bytes of
  // id, space, position and direction that lead the packet.
  if (gunIndex >= 0 && gunIndex < 255) {
    for (const entry of entries) {
      const id = u32(stream, entry.from);
      for (let at = entry.from + 44; at + 4 <= entry.to; at += 1) {
        if (stream[at] !== gunIndex || stream[at + 3] !== gunIndex + 1) continue;
        const series = gun.get(id) ?? [];
        if (!series.some(([when]) => when === entry.at)) {
          series.push([entry.at, view.getUint16(at + 1, true)]);
          series.sort((a, b) => a[0] - b[0]);
          gun.set(id, series);
        }
        break;
      }
    }
  }
  // The client's `decodeAngleFromUint(code >> 6 & 1023, 10)`.
  const turretOf = (id: number): [number, number][] =>
    (gun.get(id) ?? []).map(([at, code]) => [
      at,
      (Math.PI * 2 * ((code >> 6) & 1023)) / 1024 - Math.PI,
    ]);

  const shots = readShots(stream, view, byVehicle, fifty, bursts, hits);

  return {
    shots,
    tracks: [...byVehicle].map(([id, points]) => ({
      id,
      points,
      heading: headings.get(id) ?? null,
      hull: hulls.get(id) ?? [],
      turret: turretOf(id),
    })),
    health: [...health].map(([id, points]) => ({ id, points })),
    chat,
    kills,
    hits,
    vision,
    observed: sixthSense(lamps, bases),
    minimap: commonest(minimap),
    ammo,
    ownDamage,
    events: busiestOf(feeds),
    targetDamage: busiestOf(sights),
    duration,
    seen,
  };
}

/**
 * The view range inside one batch of component messages, or null.
 *
 * Each message is `[id u16 BE][flags u8][len u8]` and its bytes; the attrs are
 * ten of them, `u16 circularVisionRadius` then two float factors near one
 * (`gunPiercing`, `gunShotsSpeed`). The id is not used: it is assigned per
 * battle and moves again on every respawn, so the record is recognised by its
 * shape, which held with no false match over five replays. An update carries
 * the message header; the component's creation embeds the value deeper, so
 * there only the ten bytes are matched.
 */
function readVisionRadius(
  stream: Uint8Array,
  view: DataView,
  from: number,
  to: number,
  headed: boolean,
): { radius: number; base: number | null } | null {
  for (let at = from; at + 14 <= to; at += 1) {
    if (headed && (stream[at + 2] !== 0x00 || stream[at + 3] !== 0x0a)) continue;
    const body = headed ? at + 4 : at;
    const radius = view.getUint16(body, true);
    const piercing = view.getFloat32(body + 2, true);
    const speed = view.getFloat32(body + 6, true);
    if (radius >= 50 && radius <= 1000 && piercing > 0.5 && piercing < 2 && speed > 0.5 && speed < 2) {
      // The attrs are the component's second property, so its message id
      // less one is the base every other id of the component counts from.
      return { radius, base: headed ? ((stream[at] << 8) | stream[at + 1]) - 1 : null };
    }
  }
  return null;
}

/**
 * Where the sixth sense sits after the component's base: the first id past
 * its 23 properties. Measured on five replays across random, an event and
 * Frontline; the client's own definition orders it differently, so this is
 * read off the stream rather than off the `.def`.
 */
const SIXTH_SENSE_OFFSET = 23;

/** The longest of several candidate lists, the shape having matched most. */
function busiestOf<T>(lists: Map<unknown, T[]>): T[] {
  let best: T[] = [];
  for (const list of lists.values()) if (list.length > best.length) best = list;
  return best;
}

/** The far positions of the component that carries most of them. */
function commonest(
  records: { at: number; comp: number; key: number; x: number; z: number }[],
): { at: number; key: number; x: number; z: number }[] {
  const counts = new Map<number, number>();
  for (const record of records) counts.set(record.comp, (counts.get(record.comp) ?? 0) + 1);
  const comp = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  return records
    .filter((record) => record.comp === comp)
    .map(({ at, key, x, z }) => ({ at, key, x, z }));
}

/**
 * Which vehicle each far position is about.
 *
 * The key is `0xc0` plus twice an index into the battle's ids in ascending
 * order (`ClientArena.__rebuildIndexToId`), but ROTATED by an amount the
 * stream does not state and that differs between battles: none on one battle
 * measured, ten places on another, where the index wrapped past the last id
 * back to the first. The rotation is found at the hand-offs: when a vehicle
 * crosses the 565 m line its tracked positions stop and its far ones start (or
 * the reverse), at the same place within a second. Each run of far positions
 * is matched to the tracked vehicle it continues or hands back to, and the
 * rotation most of them agree on is the one. Matching every far position
 * against every track instead was tried first and is fooled by vehicles
 * standing together. Null when nothing hands off, or when a key falls outside
 * the battle's range, which would mean the layout is not the one measured.
 */
export function minimapIndex(
  records: { at: number; key: number; x: number; z: number }[],
  ids: number[],
  tracks: { id: number; points: [number, number, number, number][] }[],
): Map<number, number> | null {
  const order = [...ids].sort((a, b) => a - b);
  const place = new Map(order.map((id, index) => [id, index]));
  // Runs of far positions per key: a new run after more than four seconds.
  const byKey = new Map<number, { at: number; x: number; z: number }[]>();
  for (const record of records) {
    if (record.x === FAR_LOST) continue;
    const list = byKey.get(record.key) ?? [];
    list.push(record);
    byKey.set(record.key, list);
  }
  const edges: { key: number; at: number; x: number; z: number; leaving: boolean }[] = [];
  for (const [key, list] of byKey) {
    list.forEach((record, at) => {
      if (at === 0 || record.at - list[at - 1].at > 4) edges.push({ key, ...record, leaving: true });
      if (at === list.length - 1 || list[at + 1].at - record.at > 4) {
        edges.push({ key, ...record, leaving: false });
      }
    });
  }
  const count = order.length;
  if (count === 0 || records.some((record) => record.key < FAR_KEY_BASE || record.key >= FAR_KEY_BASE + 2 * count)) {
    return null;
  }
  const slot = (key: number) => (key - FAR_KEY_BASE) / 2;
  const votes = new Map<number, number>();
  for (const edge of edges) {
    for (const track of tracks) {
      const index = place.get(track.id);
      if (index === undefined) continue;
      // Leaving: the last tracked position just before the run starts.
      // Coming back: the first one just after it ends.
      const near = track.points.find(([when, x, , z]) =>
        (edge.leaving ? when <= edge.at && edge.at - when < 1.5 : when >= edge.at && when - edge.at < 2.5) &&
        Math.hypot(x - edge.x, z - edge.z) < 20,
      );
      if (!near) continue;
      const turn = (((slot(edge.key) - index) % count) + count) % count;
      votes.set(turn, (votes.get(turn) ?? 0) + 1);
    }
  }
  const best = [...votes].sort((a, b) => b[1] - a[1])[0];
  if (!best) return null;
  const out = new Map<number, number>();
  order.forEach((id, index) => out.set(FAR_KEY_BASE + 2 * ((index + best[0]) % count), id));
  return out;
}

/** A far position's "no position": the team lost the vehicle. */
export const FAR_LOST = -32768;

/** Where the far positions' keys start (see `minimapIndex`). */
const FAR_KEY_BASE = 0xc0;

/**
 * The lone one-byte messages that are the sixth sense. Matched on the base
 * when the attrs gave one; a battle whose attrs never changed gives none, and
 * there the commonest id among them stands in, which in every replay measured
 * was the lamp's.
 */
function sixthSense(
  lamps: { at: number; id: number; kind: number }[],
  bases: Set<number>,
): number[] {
  let keep = (id: number) => bases.has(id - SIXTH_SENSE_OFFSET);
  if (bases.size === 0) {
    const counts = new Map<number, number>();
    for (const lamp of lamps) {
      if (lamp.kind < 4) counts.set(lamp.id, (counts.get(lamp.id) ?? 0) + 1);
    }
    const commonest = [...counts].sort((x, y) => y[1] - x[1])[0]?.[0];
    keep = (id) => id === commonest;
  }
  const out: number[] = [];
  for (const lamp of lamps) {
    // `SPECIAL_RECON` (4) never lights the lamp in the client, and nothing
    // past it is a detection type.
    if (!keep(lamp.id) || lamp.kind >= 4) continue;
    if (out.at(-1) !== lamp.at) out.push(lamp.at);
  }
  return out;
}

/** How far a shell with no known end is drawn along its heading, in metres. */
const UNSEEN_SHOT_REACH = 150;

/** How long after firing a vehicle's damage can still be this shell's, in seconds. */
const HIT_WINDOW = 4;

/**
 * The shells, out of the method calls collected during the walk.
 *
 * The tracer is the avatar's `showTracer(shooterID, shotID, isRicochet,
 * effectsIndex, prefabEffIndex, shellTypeIdx, shellCaliber, refStartPoint,
 * velocity, gravity, maxShotDist, gunIndex, gunInstallationIndex)`: fifty
 * bytes, the shooter an id the tracks know, the start three floats at +16 and
 * the velocity three more at +28. Of the fifty-byte methods, it is the one
 * whose shooter is a tracked vehicle most often. The burst is
 * `explodeProjectile(shotID, effectsIndex, prefabEffIndex, effectMaterialIndex,
 * shellTypeIdx, shellCaliber, endPoint, velocityDir, speed, damagedDestructibles)`:
 * the end point at +12, and the method whose first field matches a tracer's
 * shot id most often. Measured on four battles: the start lands a median of
 * 1.1 to 1.8 metres from the shooter's own position, which is the muzzle.
 */
function readShots(
  stream: Uint8Array,
  view: DataView,
  vehicles: Map<number, [number, number, number, number][]>,
  fifty: Map<number, { at: number; offset: number }[]>,
  bursts: Map<number, { at: number; offset: number }[]>,
  hits: Hit[],
): Shot[] {
  const f = (offset: number) => view.getFloat32(offset, true);
  let tracers: { at: number; offset: number }[] = [];
  let best = 0;
  for (const calls of fifty.values()) {
    const fromVehicles = calls.filter((call) => vehicles.has(u32(stream, call.offset))).length;
    if (fromVehicles > best) {
      best = fromVehicles;
      tracers = calls;
    }
  }
  const shotIds = new Set(tracers.map((call) => u32(stream, call.offset + 4)));
  let burstCalls: { at: number; offset: number }[] = [];
  best = 0;
  for (const calls of bursts.values()) {
    const matching = calls.filter((call) => shotIds.has(u32(stream, call.offset))).length;
    if (matching > best) {
      best = matching;
      burstCalls = calls;
    }
  }
  const burstOf = new Map(
    burstCalls.map((call) => [
      u32(stream, call.offset),
      { at: call.at, x: f(call.offset + 12), z: f(call.offset + 20) },
    ]),
  );
  // A vehicle's damage, by shooter, to end the shells that struck a vehicle.
  const hitsBy = new Map<number, Hit[]>();
  for (const hit of hits) {
    const list = hitsBy.get(hit.by) ?? [];
    list.push(hit);
    hitsBy.set(hit.by, list);
  }
  const used = new Set<Hit>();
  const positionAt = (id: number, at: number) => {
    let found: { x: number; z: number } | null = null;
    for (const point of vehicles.get(id) ?? []) {
      if (point[0] > at) break;
      found = { x: point[1], z: point[3] };
    }
    return found;
  };

  const shots: Shot[] = [];
  for (const call of tracers) {
    const by = u32(stream, call.offset);
    if (!vehicles.has(by)) continue;
    const x = f(call.offset + 16);
    const z = f(call.offset + 24);
    const vx = f(call.offset + 28);
    const vz = f(call.offset + 36);
    if (![x, z, vx, vz].every(Number.isFinite)) continue;
    const heading = Math.atan2(vx, vz);
    const ricochet = view.getUint8(call.offset + 8) !== 0;
    const burst = burstOf.get(u32(stream, call.offset + 4));
    let to: { x: number; z: number } | null = null;
    let endAt: number | null = null;
    let victim: number | null = null;
    if (burst && Number.isFinite(burst.x) && Number.isFinite(burst.z)) {
      to = { x: burst.x, z: burst.z };
      endAt = burst.at;
    } else {
      // The first damage this shooter dealt after firing, inside the window.
      const hit = (hitsBy.get(by) ?? []).find(
        (one) => !used.has(one) && one.at >= call.at && one.at - call.at <= HIT_WINDOW,
      );
      const where = hit ? positionAt(hit.victim, hit.at) : null;
      if (hit && where) {
        used.add(hit);
        to = where;
        endAt = hit.at;
        victim = hit.victim;
      }
    }
    shots.push({ at: call.at, by, from: { x, z }, to, endAt, heading, victim, ricochet });
  }
  return shots;
}

/** Where a shell with no known end is drawn to: along its heading, a fixed reach. */
export function unseenShotEnd(shot: Shot): { x: number; z: number } {
  return {
    x: shot.from.x + Math.sin(shot.heading) * UNSEEN_SHOT_REACH,
    z: shot.from.z + Math.cos(shot.heading) * UNSEEN_SHOT_REACH,
  };
}
