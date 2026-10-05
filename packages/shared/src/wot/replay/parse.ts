import { Blowfish } from "./blowfish";

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

export type ReplayMotion = {
  tracks: Track[];
  /** How long the stream runs, in seconds. */
  duration: number;
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
export function readMotion(stream: Uint8Array): ReplayMotion {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const byVehicle = new Map<number, [number, number, number, number][]>();
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
  }

  return {
    tracks: [...byVehicle].map(([id, points]) => ({
      id,
      points,
      heading: headings.get(id) ?? null,
    })),
    duration,
    seen,
  };
}
