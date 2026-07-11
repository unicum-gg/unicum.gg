import { Region } from "@unicum.gg/wargaming/region";

// The Mark of Mastery thresholds are computed by WG servers and are not exposed
// by the public WG API, so we mirror the community aggregate published by
// poliroid. This file is the ONLY place that knows about that provider: the day
// we run our own battle-result harvesting (our own mod), swapping the source is
// a single-file change and neither the DB nor the page moves.

const BASE_URL = "https://poliroid.me/mastery/api/v2/data";
const FETCH_TIMEOUT_MS = 15_000;

// Poliroid keys its realms by WG's internal codes, not our region slugs: North
// America is `com` (worldoftanks.com), not `na`. EU and Asia already match.
const REALM: Record<Region, string> = {
  [Region.EU]: "eu",
  [Region.NA]: "com",
  [Region.ASIA]: "asia",
};

export type MomEntry = {
  tankId: number;
  // XP required for each badge, from least to most demanding.
  class3: number;
  class2: number;
  class1: number;
  ace: number;
};

// Shape of the poliroid `data/{region}/vehicles` response. `id` is the WG
// tank_id; `mastery` is [3rd, 2nd, 1st, Ace].
type PoliroidResponse = {
  status: string;
  data?: {
    meta?: { count?: number; version?: number };
    data?: { id: number; mastery: [number, number, number, number] }[];
  };
};

/**
 * Fetch the current per-vehicle mastery XP thresholds for one region. Entries
 * with a malformed `mastery` tuple are skipped rather than failing the whole
 * batch. Throws on network / HTTP / bad-status so the caller can log-and-skip
 * that region (the cron keeps the last DB snapshot, fail-open).
 */
export async function fetchMomFromPoliroid(
  region: Region,
): Promise<MomEntry[]> {
  const res = await fetch(`${BASE_URL}/${REALM[region]}/vehicles`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`poliroid mastery ${region}: HTTP ${res.status}`);
  }
  const body = (await res.json()) as PoliroidResponse;
  if (body.status !== "ok" || !body.data?.data) {
    throw new Error(`poliroid mastery ${region}: unexpected payload`);
  }

  const out: MomEntry[] = [];
  for (const v of body.data.data) {
    const m = v.mastery;
    if (
      !Array.isArray(m) ||
      m.length < 4 ||
      m.some((n) => !Number.isFinite(n))
    ) {
      continue;
    }
    out.push({
      tankId: v.id,
      class3: m[0],
      class2: m[1],
      class1: m[2],
      ace: m[3],
    });
  }
  return out;
}

export type MomHistoryPoint = {
  // ISO day the aggregate is for, "YYYY-MM-DD".
  day: string;
  class3: number;
  class2: number;
  class1: number;
  ace: number;
};

type PoliroidHistoryResponse = {
  status: string;
  data?: {
    data?: { date: string; mastery: [number, number, number, number] }[];
  };
};

/**
 * Per-vehicle Mark of Mastery history for one region (poliroid keeps ~35 daily
 * points). Returned oldest → newest so a chart reads left-to-right, malformed
 * days dropped. Throws on network / HTTP / bad-status; callers cache and
 * fail-open (an empty history just hides the chart).
 */
export async function fetchMomHistoryFromPoliroid(
  region: Region,
  tankId: number,
): Promise<MomHistoryPoint[]> {
  const res = await fetch(`${BASE_URL}/${REALM[region]}/vehicle/${tankId}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(
      `poliroid mastery history ${region}/${tankId}: HTTP ${res.status}`,
    );
  }
  const body = (await res.json()) as PoliroidHistoryResponse;
  if (body.status !== "ok" || !body.data?.data) {
    throw new Error(
      `poliroid mastery history ${region}/${tankId}: unexpected payload`,
    );
  }

  const out: MomHistoryPoint[] = [];
  for (const p of body.data.data) {
    const m = p.mastery;
    if (
      !p.date ||
      !Array.isArray(m) ||
      m.length < 4 ||
      m.some((n) => !Number.isFinite(n))
    ) {
      continue;
    }
    out.push({ day: p.date, class3: m[0], class2: m[1], class1: m[2], ace: m[3] });
  }
  return out.reverse();
}
