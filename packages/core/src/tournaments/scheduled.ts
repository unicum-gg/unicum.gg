import type { TournamentDetail, TournamentSummary } from "@unicum.gg/wargaming";
import { sql } from "drizzle-orm";

// How a tournament from the API becomes a row, and the guard that decides
// whether it may become one at all. Split out of the mirror because it is the
// only part of it that is pure: no database, no fetch, just the shape.

/**
 * A tournament whose dates are set, which is the only kind the mirror can hold.
 *
 * The system lets an organiser create a tournament before scheduling it and
 * sends `0` for both bounds while it sits there, teams already registering
 * against it (EU's "OLS S7" carried eight). Storing that meant January 1970,
 * which is not merely an ugly date: `isArchived` reads `end_at`, so an unplayed
 * tournament would be classed as settled decades ago, dropped by the live pass
 * that should be watching it, and left with an empty bracket for good once it
 * was actually played. It is skipped instead, and arrives on its own the moment
 * Wargaming gives it a date.
 *
 * Nothing is lost by skipping, which was worth checking rather than assuming:
 * a dateless tournament carries no stages either, so there is no bracket, no
 * match and no result behind it. That holds for the abandoned ones too, and
 * they are not all drafts: EU's "Spring Joust 2026 | 5v5 Play-off" sits at
 * `complete` with four teams registered, no dates and no stages, which is a
 * tournament that was created and never run rather than history we are
 * dropping.
 */
export type ScheduledTournament<T> = T & { startAt: Date; endAt: Date };

export function isScheduled<T extends { startAt: Date | null; endAt: Date | null }>(
  t: T,
): t is ScheduledTournament<T> {
  return t.startAt !== null && t.endAt !== null;
}

export function summaryRow(t: ScheduledTournament<TournamentSummary>) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    language: t.language,
    status: t.status,
    gameModes: t.gameModes as string[],
    tierFrom: t.tierFrom,
    tierTo: t.tierTo,
    minPlayersInTeam: t.teamSize.min,
    maxPlayersInTeam: t.teamSize.max,
    teamsLimit: t.teamsLimit,
    confirmedTeams: t.confirmedTeams,
    startAt: t.startAt,
    endAt: t.endAt,
    registrationFrom: t.registrationFrom,
    registrationTill: t.registrationTill,
    prize: t.prize,
    tags: t.tags,
    logoUrl: t.logoUrl,
    isFeatured: t.isFeatured,
    syncedAt: new Date(),
  };
}

export function detailRow(t: ScheduledTournament<TournamentDetail>) {
  return {
    ...summaryRow(t),
    prizeTiers: t.prizeTiers,
    rules: t.rules,
    mapPool: t.mapPool.map((m) => m.arenaId),
    bracketTypes: t.bracketTypes as string[],
    totalLevelFrom: t.totalLevelLimit?.from ?? null,
    totalLevelTo: t.totalLevelLimit?.to ?? null,
    schedule: t.schedule.map((s) => ({ title: s.title, startAt: s.startAt.toISOString() })),
    // Only stamped once the bracket below it has been written, and only inside
    // the same transaction, so a run that dies mid-mirror leaves the tournament
    // pending rather than claiming a half-written bracket as done.
    detailSyncedAt: new Date(),
  };
}

export function detailSet() {
  return {
    title: sql`excluded.title`,
    description: sql`excluded.description`,
    status: sql`excluded.status`,
    gameModes: sql`excluded.game_modes`,
    tierFrom: sql`excluded.tier_from`,
    tierTo: sql`excluded.tier_to`,
    minPlayersInTeam: sql`excluded.min_players_in_team`,
    maxPlayersInTeam: sql`excluded.max_players_in_team`,
    teamsLimit: sql`excluded.teams_limit`,
    confirmedTeams: sql`excluded.confirmed_teams`,
    startAt: sql`excluded.start_at`,
    endAt: sql`excluded.end_at`,
    registrationFrom: sql`excluded.registration_from`,
    registrationTill: sql`excluded.registration_till`,
    prize: sql`excluded.prize`,
    prizeTiers: sql`excluded.prize_tiers`,
    rules: sql`excluded.rules`,
    tags: sql`excluded.tags`,
    logoUrl: sql`excluded.logo_url`,
    isFeatured: sql`excluded.is_featured`,
    mapPool: sql`excluded.map_pool`,
    bracketTypes: sql`excluded.bracket_types`,
    totalLevelFrom: sql`excluded.total_level_from`,
    totalLevelTo: sql`excluded.total_level_to`,
    schedule: sql`excluded.schedule`,
    detailSyncedAt: sql`excluded.detail_synced_at`,
    syncedAt: sql`excluded.synced_at`,
  };
}