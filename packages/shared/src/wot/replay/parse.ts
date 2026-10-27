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

export type ReplayMotion = {
  tracks: Track[];
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

export function readMotion(stream: Uint8Array): ReplayMotion {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const byVehicle = new Map<number, [number, number, number, number][]>();
  const health = new Map<number, [number, number][]>();
  const chat: ChatLine[] = [];
  const kills: Kill[] = [];
  const hits: Hit[] = [];
  const commandAt = new Map<string, number>();
  const headings = new Map<number, number>();
  const seen: Record<number, number> = {};
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

  return {
    tracks: [...byVehicle].map(([id, points]) => ({
      id,
      points,
      heading: headings.get(id) ?? null,
    })),
    health: [...health].map(([id, points]) => ({ id, points })),
    chat,
    kills,
    hits,
    duration,
    seen,
  };
}
