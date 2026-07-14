import { botHeaders, type WN8Expected, type WNXExpected } from "@unicum.gg/shared";

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

const EXPECTED_TTL_MS = 60 * 60 * 1000;

// Module-level cache + in-flight promise dedup: the Next fetch `revalidate`
// option only caches inside the request lifecycle, so crons re-hit the origin
// every snapshot and get 429'd. Hold the parsed Map in memory for 1h instead.
const expectedCache = <T>() => {
  let entry: { value: T; expiresAt: number } | null = null;
  let inFlight: Promise<T> | null = null;
  return async (load: () => Promise<T>): Promise<T> => {
    if (entry && entry.expiresAt > Date.now()) return entry.value;
    if (inFlight) return inFlight;
    inFlight = load()
      .then((value) => {
        entry = { value, expiresAt: Date.now() + EXPECTED_TTL_MS };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
};

const wn8Cache = expectedCache<Map<number, WN8Expected>>();

export async function getWN8ExpectedValues(): Promise<Map<number, WN8Expected>> {
  return wn8Cache(async () => {
    // The `/wg/wn8exp.json` URL is the auto-updating "latest" pointer that
    // XVM regenerates daily and that includes the post-2024 tanks (Tier 11,
    // recent premiums). The plain `/wn8exp.json` URL is a stale 2024-09
    // snapshot — it was missing ~100 tanks. See `/en/wn8-expected-values-by-date/`.
    const res = await fetch(
      "https://static.modxvm.com/wn8-data-exp/json/wg/wn8exp.json",
      { headers: botHeaders() },
    );
    if (!res.ok) {
      throw new Error(`WN8 expected values HTTP ${res.status}`);
    }
    const json = (await res.json()) as { data: WN8ExpectedRaw[] };
    const map = new Map<number, WN8Expected>();
    for (const entry of json.data) {
      map.set(entry.IDNum, {
        expDamage: entry.expDamage,
        expSpot: entry.expSpot,
        expFrag: entry.expFrag,
        expDef: entry.expDef,
        expWinRate: entry.expWinRate,
      });
    }
    return map;
  });
}

const wnxCache = expectedCache<Map<number, WNXExpected>>();

export async function getWNXExpectedValues(): Promise<Map<number, WNXExpected>> {
  return wnxCache(async () => {
    const res = await fetch(
      "https://api.tomato.gg/api/wnx/wnx-expected-values.json",
      { headers: botHeaders() },
    );
    if (!res.ok) {
      throw new Error(`WNX expected values HTTP ${res.status}`);
    }
    const json = (await res.json()) as { data: WNXExpectedRaw[] };
    const map = new Map<number, WNXExpected>();
    for (const e of json.data) {
      map.set(e.tank_id, {
        damage: e.expected_damage,
        frags: e.expected_frags,
        spots: e.expected_spots,
        assist: e.expected_assistance,
      });
    }
    return map;
  });
}
