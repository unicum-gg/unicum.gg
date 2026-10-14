import { eq, sql } from "drizzle-orm";
import {
  botHeaders,
  ExpectedValuesSource,
  expectedValues,
  type WN8Expected,
  type WNXExpected,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

type WN8ExpectedRaw = {
  IDNum: number;
  expDamage: number;
  expSpot: number;
  expFrag: number;
  expDef: number;
  expWinRate: number;
};

type WNXExpectedRaw = {
  tank_id: number;
  expected_damage: number;
  expected_frags: number;
  expected_spots: number;
  expected_assistance: number;
};

/** What both origins answer: the per-tank rows under one key. */
type ExpectedPayload<Raw> = { data: Raw[] };

const EXPECTED_TTL_MS = 60 * 60 * 1000;

// How long a table that failed to refresh is served before the origin is asked
// again. Short against the hour above, because what is being served is by then
// known to be behind, and long enough that an origin which is down is asked
// every few minutes per process rather than once per page view.
const EXPECTED_RETRY_MS = 5 * 60 * 1000;

/** The stored table, or null when none has ever been written or the read fails.
 * Never throws: this is the path taken because something else already failed,
 * and a second error here would put the 500 back that it exists to prevent. */
async function readStored<Raw>(
  source: ExpectedValuesSource,
): Promise<{ rows: Raw[]; fetchedAt: Date } | null> {
  try {
    const [row] = await db
      .select({
        payload: expectedValues.payload,
        fetchedAt: expectedValues.fetchedAt,
      })
      .from(expectedValues)
      .where(eq(expectedValues.source, source))
      .limit(1);
    if (!row) return null;
    const rows = (row.payload as ExpectedPayload<Raw>).data;
    return Array.isArray(rows) ? { rows, fetchedAt: row.fetchedAt } : null;
  } catch (error) {
    console.error(`[${source}-expected] could not read the stored table:`, error);
    return null;
  }
}

/** Keep what the origin just served, so the next outage has something recent to
 * fall back on. Deliberately not awaited by the caller and never fatal: this is
 * insurance against a future failure, and making a page render wait on it, or
 * fail with it, would trade the thing it protects for the thing it prevents. */
function writeStored(
  source: ExpectedValuesSource,
  payload: ExpectedPayload<unknown>,
): void {
  void db
    .insert(expectedValues)
    .values({ source, payload })
    .onConflictDoUpdate({
      target: expectedValues.source,
      set: { payload, fetchedAt: sql`NOW()` },
    })
    .catch((error: unknown) => {
      console.error(`[${source}-expected] could not store the table:`, error);
    });
}

const hoursSince = (at: Date): number =>
  Math.round((Date.now() - at.getTime()) / 36e5);

// Module-level cache + in-flight promise dedup: the Next fetch `revalidate`
// option only caches inside the request lifecycle, so crons re-hit the origin
// every snapshot and get 429'd. Hold the parsed Map in memory for 1h instead.
//
// A failed refresh NEVER throws, and that is the point of the shape. Both
// origins are third parties we do not run, and these tables are read on the way
// to rendering any player page, so a throw here is a 500 on every profile on
// the site: XVM's host went down on 2026-10-14 (Cloudflare 521, their own
// origin refusing connections) and that is exactly what happened.
//
// Falling back, in order: the table already held in this process, then the last
// one we successfully read, from `expected_values`, then an empty map. The last
// is not a failure state dressed up as a value. A tank with no expected values
// is skipped by `wn8AccAdd` and `wn8Finalize` then answers null, so a process
// that has never completed a fetch renders profiles with no rating rather than
// no page, which is the honest reading of what we know.
const expectedCache = <Raw, T>(
  source: ExpectedValuesSource,
  toMap: (rows: Raw[]) => T,
) => {
  let entry: { value: T; expiresAt: number } | null = null;
  let inFlight: Promise<T> | null = null;

  const onFailure = async (error: unknown): Promise<T> => {
    const held = entry?.value;
    if (held !== undefined) {
      console.error(
        `[${source}-expected] refresh failed, serving the table already held:`,
        error,
      );
      return held;
    }
    const stored = await readStored<Raw>(source);
    if (stored) {
      console.error(
        `[${source}-expected] refresh failed, serving the table stored ${hoursSince(stored.fetchedAt)}h ago:`,
        error,
      );
      return toMap(stored.rows);
    }
    console.error(
      `[${source}-expected] refresh failed and nothing is stored, ratings will read as absent:`,
      error,
    );
    return toMap([]);
  };

  return async (fetchPayload: () => Promise<ExpectedPayload<Raw>>): Promise<T> => {
    if (entry && entry.expiresAt > Date.now()) return entry.value;
    if (inFlight) return inFlight;
    inFlight = fetchPayload()
      .then((payload) => {
        const value = toMap(payload.data);
        entry = { value, expiresAt: Date.now() + EXPECTED_TTL_MS };
        writeStored(source, payload);
        return value;
      })
      .catch(async (error: unknown) => {
        const value = await onFailure(error);
        entry = { value, expiresAt: Date.now() + EXPECTED_RETRY_MS };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
};

function toWN8Map(rows: WN8ExpectedRaw[]): Map<number, WN8Expected> {
  const map = new Map<number, WN8Expected>();
  for (const entry of rows) {
    map.set(entry.IDNum, {
      expDamage: entry.expDamage,
      expSpot: entry.expSpot,
      expFrag: entry.expFrag,
      expDef: entry.expDef,
      expWinRate: entry.expWinRate,
    });
  }
  return map;
}

const wn8Cache = expectedCache(ExpectedValuesSource.WN8, toWN8Map);

export async function getWN8ExpectedValues(): Promise<Map<number, WN8Expected>> {
  return wn8Cache(async () => {
    // The `/wg/wn8exp.json` URL is the auto-updating "latest" pointer that
    // XVM regenerates daily and that includes the post-2024 tanks (Tier 11,
    // recent premiums). The plain `/wn8exp.json` URL is a stale 2024-09
    // snapshot, missing ~100 tanks. See `/en/wn8-expected-values-by-date/`.
    const res = await fetch(
      "https://static.modxvm.com/wn8-data-exp/json/wg/wn8exp.json",
      { headers: botHeaders() },
    );
    if (!res.ok) {
      throw new Error(`WN8 expected values HTTP ${res.status}`);
    }
    return (await res.json()) as ExpectedPayload<WN8ExpectedRaw>;
  });
}

function toWNXMap(rows: WNXExpectedRaw[]): Map<number, WNXExpected> {
  const map = new Map<number, WNXExpected>();
  for (const e of rows) {
    map.set(e.tank_id, {
      damage: e.expected_damage,
      frags: e.expected_frags,
      spots: e.expected_spots,
      assist: e.expected_assistance,
    });
  }
  return map;
}

const wnxCache = expectedCache(ExpectedValuesSource.WNX, toWNXMap);

export async function getWNXExpectedValues(): Promise<Map<number, WNXExpected>> {
  return wnxCache(async () => {
    const res = await fetch(
      "https://api.tomato.gg/api/wnx/wnx-expected-values.json",
      { headers: botHeaders() },
    );
    if (!res.ok) {
      throw new Error(`WNX expected values HTTP ${res.status}`);
    }
    return (await res.json()) as ExpectedPayload<WNXExpectedRaw>;
  });
}
