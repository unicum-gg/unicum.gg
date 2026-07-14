/** Per-tank aggregate across a clan's members (client-safe shape). The DB
 * query lives in core (`clans/repository/tanks`). */
export type ClanTankAggregate = {
  tankId: number;
  memberCount: number;
  battles: number;
  wins: number;
  damageDealt: number;
  frags: number;
  spotted: number;
  droppedCapturePoints: number;
  radioAssistedDamage: number;
  trackAssistedDamage: number;
  xp: number;
};
