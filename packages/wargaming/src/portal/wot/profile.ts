import { Region, REGION_WOT_HOST } from "../../region";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";

export type PortalVehicleMarks = {
  tankId: number;
  /** Marks of Excellence on the gun (0-3). */
  marksOnGun: number;
  /** Mark of Mastery badge (0-4). */
  markOfMastery: number;
};

// The profile vehicles endpoint returns each vehicle as a positional array (no
// keys). The column order is NOT fixed — it is described per response by the
// `parameters` array and varies between accounts — so we resolve the fields we
// need by name rather than hardcoding indices. Column names of interest:
const COL = {
  tankId: "vehicle_cd",
  marksOnGun: "marksOnGun",
  markOfMastery: "markOfMastery",
} as const;

type RawVehicleList = {
  status: string;
  data?: { data?: unknown[][]; parameters?: string[] };
};

/** The player-profile portal surface (`worldoftanks.<tld>/wotup/profile/*`). */
export class PortalProfileResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  /**
   * A player's per-vehicle Marks of Excellence + Mastery, from the WoT portal
   * SPA endpoint (`/wotup/profile/vehicles/list/`). Unlike the public API this
   * exposes `marks_on_gun` (0-3). One POST returns every vehicle the player has
   * fought at least one battle in.
   */
  async vehicleMarks({
    accountId,
    language = "en",
  }: {
    accountId: number;
    language?: string;
  }): Promise<PortalVehicleMarks[]> {
    const url = new URL(
      `https://${REGION_WOT_HOST[this.region]}/wotup/profile/vehicles/list/`,
    );
    const body = {
      battle_type: "random",
      only_in_garage: false,
      spa_id: accountId,
      premium: [0, 1],
      collector_vehicle: [0, 1],
      nation: [],
      role: [],
      type: [],
      language,
    };
    const res = await this.t.postJson<RawVehicleList>(url, body, {
      region: this.region,
      limit: RateLimit.Portal,
    });
    const rows = res.data?.data ?? [];
    const params = res.data?.parameters ?? [];
    const idTankId = params.indexOf(COL.tankId);
    const idMarks = params.indexOf(COL.marksOnGun);
    const idMastery = params.indexOf(COL.markOfMastery);
    // Without the column map we can't trust any position — bail rather than
    // read garbage (an unexpected schema returns no marks this cycle).
    if (idTankId < 0 || idMarks < 0) return [];
    const out: PortalVehicleMarks[] = [];
    for (const r of rows) {
      const tankId = Number(r[idTankId]);
      if (!Number.isFinite(tankId)) continue;
      out.push({
        tankId,
        marksOnGun: Number(r[idMarks]) || 0,
        markOfMastery: idMastery >= 0 ? Number(r[idMastery]) || 0 : 0,
      });
    }
    return out;
  }
}
