// Pure enums (no transport/fetch imports) so UI code can bundle them without
// dragging the client runtime.

/**
 * The eleven clan roles the game has, declared most senior first.
 *
 * That seniority is the clan portal's `role.rank` (which runs the other way,
 * 10 = commander), not its `role.order`: `order` is the portal page's own
 * display sequence and puts a combat officer above a recruitment officer,
 * where the game gives the recruitment officer the higher standing. The one
 * thing `rank` cannot settle is personnel officer against quartermaster, since
 * WG gives both 8, so the tie is broken here in the game's favour.
 *
 * Declaration order is load-bearing: consumers derive a member's seniority
 * from the index, since the batchable `clans/info` roster carries the role
 * string but no rank of its own.
 */
export enum ClanRole {
  Commander = "commander",
  ExecutiveOfficer = "executive_officer",
  PersonnelOfficer = "personnel_officer",
  Quartermaster = "quartermaster",
  IntelligenceOfficer = "intelligence_officer",
  RecruitmentOfficer = "recruitment_officer",
  CombatOfficer = "combat_officer",
  JuniorOfficer = "junior_officer",
  Private = "private",
  Recruit = "recruit",
  Reservist = "reservist",
}

const CLAN_ROLE_ORDER = new Map<string, number>(
  Object.values(ClanRole).map((role, i) => [role, i]),
);

/** Seniority of a role the game does not define: below every known one. */
export const UNKNOWN_CLAN_ROLE_ORDER = CLAN_ROLE_ORDER.size;

/** Seniority of a clan role, 0 = commander. An unknown role sorts last. */
export const clanRoleOrder = (role: string): number =>
  CLAN_ROLE_ORDER.get(role) ?? UNKNOWN_CLAN_ROLE_ORDER;

/** Whether `role` is one of the roles the game defines. */
export const isClanRole = (role: string): role is ClanRole =>
  CLAN_ROLE_ORDER.has(role);

export enum ClanEventType {
  JoinClan = "join_clan",
  LeaveClan = "leave_clan",
  ChangeRole = "change_role",
}
