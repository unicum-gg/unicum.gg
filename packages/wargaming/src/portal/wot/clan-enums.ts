// Pure enums (no transport/fetch imports) so UI code can bundle them without
// dragging the client runtime.
export enum ClanRole {
  Commander = "commander",
  ExecutiveOfficer = "executive_officer",
  PersonnelOfficer = "personnel_officer",
  CombatOfficer = "combat_officer",
  IntelligenceOfficer = "intelligence_officer",
  Quartermaster = "quartermaster",
  Diplomat = "diplomat",
  Recruiter = "recruiter",
  Treasurer = "treasurer",
  JuniorOfficer = "junior_officer",
  Private = "private",
  Recruit = "recruit",
  Reservist = "reservist",
}

export enum ClanEventType {
  JoinClan = "join_clan",
  LeaveClan = "leave_clan",
  ChangeRole = "change_role",
}
