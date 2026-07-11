import { Region } from "@unicum.gg/wargaming/region";

// Marks of Excellence thresholds are computed by WG servers and are not exposed
// by the public WG API, so we mirror the community aggregate published by
// poliroid (its "gunmarks" service). This file is the ONLY place that knows
// about that provider: swapping the source (e.g. our own harvesting) is a
// single-file change, the DB and page never move.

const BASE_URL = "https://poliroid.me/gunmarks/api/v2/data";
const FETCH_TIMEOUT_MS = 15_000;

// The gunmarks endpoint takes the requested percentiles in the path. The three
// Marks of Excellence map to WG's 65th / 85th / 95th combined-damage percentiles
// (1 / 2 / 3 marks: beating 65% / 85% / 95% of players over the last 14 days).
const PERCENTILES = [65, 85, 95] as const;

// Poliroid keys its realms by WG's internal codes, not our region slugs: North
// America is `com` (worldoftanks.com), not `na`. EU and Asia already match.
const REALM: Record<Region, string> = {
  [Region.EU]: "eu",
  [Region.NA]: "com",
  [Region.ASIA]: "asia",
};

export type MoeEntry = {
  tankId: number;
  // Combined damage required for each mark, from easiest to hardest.
  mark1: number;
  mark2: number;
  mark3: number;
};

// Shape of the poliroid `gunmarks/data/{realm}/vehicles/{percentiles}` response.
// `id` is the WG tank_id; `marks` is keyed by the requested percentile.
type PoliroidResponse = {
  status: string;
  data?: {
    meta?: { count?: number; version?: number };
    data?: { id: number; marks: Record<string, number> }[];
  };
};

/**
 * Fetch the current per-vehicle Marks of Excellence combined-damage thresholds
 * for one region. Entries missing any of the three percentiles are skipped.
 * Throws on network / HTTP / bad-status so the caller can log-and-skip that
 * region (the cron keeps the last DB snapshot, fail-open).
 */
export async function fetchMoeFromPoliroid(
  region: Region,
): Promise<MoeEntry[]> {
  const res = await fetch(
    `${BASE_URL}/${REALM[region]}/vehicles/${PERCENTILES.join(",")}`,
    {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    throw new Error(`poliroid gunmarks ${region}: HTTP ${res.status}`);
  }
  const body = (await res.json()) as PoliroidResponse;
  if (body.status !== "ok" || !body.data?.data) {
    throw new Error(`poliroid gunmarks ${region}: unexpected payload`);
  }

  const out: MoeEntry[] = [];
  for (const v of body.data.data) {
    const m = v.marks;
    const mark1 = m?.["65"];
    const mark2 = m?.["85"];
    const mark3 = m?.["95"];
    if (
      !Number.isFinite(mark1) ||
      !Number.isFinite(mark2) ||
      !Number.isFinite(mark3)
    ) {
      continue;
    }
    out.push({ tankId: v.id, mark1, mark2, mark3 });
  }
  return out;
}

export type MoeHistoryPoint = {
  // ISO day the aggregate is for, "YYYY-MM-DD".
  day: string;
  mark1: number;
  mark2: number;
  mark3: number;
};

type PoliroidHistoryResponse = {
  status: string;
  data?: {
    data?: { date: string; marks: Record<string, number> }[];
  };
};

/**
 * Per-vehicle Marks of Excellence history for one region (poliroid keeps ~35
 * daily points). Returned oldest → newest so a chart reads left-to-right, with
 * malformed days dropped. Throws on network / HTTP / bad-status; callers cache
 * and fail-open (an empty history just hides the chart).
 */
export async function fetchMoeHistoryFromPoliroid(
  region: Region,
  tankId: number,
): Promise<MoeHistoryPoint[]> {
  const res = await fetch(
    `${BASE_URL}/${REALM[region]}/vehicle/${tankId}/${PERCENTILES.join(",")}`,
    {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    throw new Error(
      `poliroid gunmarks history ${region}/${tankId}: HTTP ${res.status}`,
    );
  }
  const body = (await res.json()) as PoliroidHistoryResponse;
  if (body.status !== "ok" || !body.data?.data) {
    throw new Error(
      `poliroid gunmarks history ${region}/${tankId}: unexpected payload`,
    );
  }

  const out: MoeHistoryPoint[] = [];
  for (const p of body.data.data) {
    const mark1 = p.marks?.["65"];
    const mark2 = p.marks?.["85"];
    const mark3 = p.marks?.["95"];
    if (
      !p.date ||
      !Number.isFinite(mark1) ||
      !Number.isFinite(mark2) ||
      !Number.isFinite(mark3)
    ) {
      continue;
    }
    out.push({ day: p.date, mark1, mark2, mark3 });
  }
  return out.reverse();
}
