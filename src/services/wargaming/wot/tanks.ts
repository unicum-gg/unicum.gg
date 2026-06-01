import type { Region } from ".";
import { wgFetch } from "./fetch";

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

const TANKS_STATS_BATCH_SIZE = 100;

export async function getTanksStatsBatch(
  region: Region,
  accountIds: number[],
): Promise<Map<number, TankStats[]>> {
  const out = new Map<number, TankStats[]>();
  const unique = Array.from(new Set(accountIds));
  for (let i = 0; i < unique.length; i += TANKS_STATS_BATCH_SIZE) {
    const batch = unique.slice(i, i + TANKS_STATS_BATCH_SIZE);
    const data = await wgFetch<Record<string, TankStats[] | null>>(
      region,
      "/wot/tanks/stats/",
      {
        account_id: batch.join(","),
        fields: TANK_STATS_FIELDS,
      },
    );
    for (const [id, tanks] of Object.entries(data)) {
      out.set(Number(id), tanks ?? []);
    }
  }
  return out;
}
