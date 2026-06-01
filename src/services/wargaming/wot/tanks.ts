import type { Region } from ".";
import { WargamingApiError, wgFetch } from "./fetch";

export type TankStats = {
  tank_id: number;
  all: {
    battles: number;
    damage_dealt: number;
    spotted: number;
    frags: number;
    dropped_capture_points: number;
    wins: number;
    radio_assisted_damage: number;
    track_assisted_damage: number;
  };
};

const TANK_STATS_FIELDS = [
  "tank_id",
  "all.battles",
  "all.damage_dealt",
  "all.spotted",
  "all.frags",
  "all.dropped_capture_points",
  "all.wins",
  "all.radio_assisted_damage",
  "all.track_assisted_damage",
].join(",");

export async function getTanksStats(
  region: Region,
  accountId: number,
): Promise<TankStats[]> {
  const data = await wgFetch<Record<string, TankStats[] | null>>(
    region,
    "/wot/tanks/stats/",
    {
      account_id: String(accountId),
      fields: TANK_STATS_FIELDS,
    },
  );
  return data[String(accountId)] ?? [];
}

const TANKS_STATS_BATCH_SIZE = 25;

async function fetchTanksStatsChunk(
  region: Region,
  ids: number[],
  out: Map<number, TankStats[]>,
): Promise<void> {
  if (ids.length === 0) return;
  try {
    const data = await wgFetch<Record<string, TankStats[] | null>>(
      region,
      "/wot/tanks/stats/",
      {
        account_id: ids.join(","),
        fields: TANK_STATS_FIELDS,
      },
    );
    for (const [id, tanks] of Object.entries(data)) {
      out.set(Number(id), tanks ?? []);
    }
  } catch (err) {
    // WG rejects the WHOLE chunk if any account_id is invalid (deleted/banned).
    // Bisect to isolate the bad one. Single bad id → just skip it.
    if (
      err instanceof WargamingApiError &&
      err.code === "INVALID_ACCOUNT_ID" &&
      ids.length > 1
    ) {
      const mid = Math.floor(ids.length / 2);
      await Promise.all([
        fetchTanksStatsChunk(region, ids.slice(0, mid), out),
        fetchTanksStatsChunk(region, ids.slice(mid), out),
      ]);
      return;
    }
    if (
      err instanceof WargamingApiError &&
      err.code === "INVALID_ACCOUNT_ID"
    ) {
      // single bad id → silently drop it
      return;
    }
    throw err;
  }
}

export async function getTanksStatsBatch(
  region: Region,
  accountIds: number[],
): Promise<Map<number, TankStats[]>> {
  const out = new Map<number, TankStats[]>();
  const unique = Array.from(new Set(accountIds));
  const chunks: number[][] = [];
  for (let i = 0; i < unique.length; i += TANKS_STATS_BATCH_SIZE) {
    chunks.push(unique.slice(i, i + TANKS_STATS_BATCH_SIZE));
  }
  const results = await Promise.allSettled(
    chunks.map((batch) => fetchTanksStatsChunk(region, batch, out)),
  );
  for (const res of results) {
    if (res.status === "rejected") {
      console.error("[tanks-stats-batch] chunk failed:", res.reason);
    }
  }
  return out;
}
