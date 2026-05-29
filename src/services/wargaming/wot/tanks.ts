import { type Region, wgFetch } from ".";

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

export async function getTanksStats(
  region: Region,
  accountId: number,
): Promise<TankStats[]> {
  const data = await wgFetch<Record<string, TankStats[] | null>>(
    region,
    "/wot/tanks/stats/",
    {
      account_id: String(accountId),
      fields: [
        "tank_id",
        "all.battles",
        "all.damage_dealt",
        "all.spotted",
        "all.frags",
        "all.dropped_capture_points",
        "all.wins",
        "all.radio_assisted_damage",
        "all.track_assisted_damage",
      ].join(","),
    },
  );
  return data[String(accountId)] ?? [];
}
