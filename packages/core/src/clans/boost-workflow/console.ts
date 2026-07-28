import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { wg } from "@unicum.gg/core/wargaming/client";
import { getWargamingAccessToken } from "@unicum.gg/core/auth/wargaming-token";
import {
  type BoostReserve,
  type ClanBoostLogEntry,
  type ClanBoostWorkflow,
  clanBoostLogByRegion,
  clanBoostWorkflowByRegion,
  reserveIconUrl,
} from "@unicum.gg/shared";
import { ClanInfoExtra, ClanRole, Region } from "@unicum.gg/wargaming";
import { isWithinWindow } from "./index";

const READY = "ready_to_activate";

// The exact set WoT lets activate Stronghold reserves, per the official
// Reserves guide: Commander, Executive Officer, Personnel Officer, Combat
// Officer (NOT Intelligence Officer / Quartermaster). WG also enforces this on
// activate, so this is only the client-side gate for showing the console.
const OFFICER_ROLES = new Set<string>([
  ClanRole.Commander,
  ClanRole.ExecutiveOfficer,
  ClanRole.PersonnelOfficer,
  ClanRole.CombatOfficer,
]);

export type OfficerDenyReason =
  | "not_logged_in"
  | "no_account"
  | "token_expired"
  | "wrong_region"
  | "not_in_clan"
  | "not_officer";

export type OfficerContext =
  | { canManage: false; reason: OfficerDenyReason }
  | {
      canManage: true;
      clanId: number;
      accountId: number;
      name: string;
      region: Region;
      role: string;
      token: string;
    };

/**
 * Resolve whether `userId` may manage a clan's boost workflows in `region`, and
 * for which clan. Everything downstream operates on THIS clanId (the token
 * owner's own clan), never a client-supplied one, so there is no cross-clan write.
 */
export async function resolveOfficerContext(
  region: Region,
  userId: string | undefined,
): Promise<OfficerContext> {
  if (!userId) return { canManage: false, reason: "not_logged_in" };
  const token = await getWargamingAccessToken(userId);
  if (!token.ok) {
    return {
      canManage: false,
      reason: token.reason === "expired" ? "token_expired" : "no_account",
    };
  }
  if (token.region !== region) return { canManage: false, reason: "wrong_region" };

  // Both only need the accountId → run them together, not one after the other.
  const [player, membership] = await Promise.all([
    wg
      .region(region)
      .api.wot.accounts.info({ accountId: token.accountId, fields: ["clan_id"] })
      .catch(() => null),
    wg
      .region(region)
      .api.wot.clans.accountinfo({
        accountId: token.accountId,
        fields: ["role", "account_name"],
      })
      .catch(() => null),
  ]);
  const clanId = player?.clan_id ?? null;
  if (!clanId) return { canManage: false, reason: "not_in_clan" };
  if (!membership || !OFFICER_ROLES.has(membership.role)) {
    return { canManage: false, reason: "not_officer" };
  }

  return {
    canManage: true,
    clanId,
    accountId: token.accountId,
    name: membership.account_name ?? "",
    region,
    role: membership.role,
    token: token.token,
  };
}

export type ReserveLevel = {
  level: number;
  amount: number;
  status: string | null;
  /** Boost strength for this level as a percentage (e.g. 400 = +400%), taken
   * from the Clan-Battles value (what Stronghold skirmishes count as). */
  percent: number | null;
};

export type ReserveOption = {
  type: string;
  bonusType: string;
  name: string;
  icon: string;
  /** How long one activation lasts, in seconds (WG `action_time`, ~7200 = 2h). */
  durationSec: number;
  /** ISO time this reserve is currently running until (any source), else null —
   * the workflow won't stack on top of it, it waits for this to expire. */
  activeUntil: string | null;
  levels: ReserveLevel[];
};

export type BoostConsole =
  | { canManage: false; reason: OfficerDenyReason }
  | {
      canManage: true;
      clanId: number;
      role: string;
      /** The viewing officer's WG account id, to tell if they own a workflow. */
      viewerAccountId: number;
      onlineNow: number;
      membersCount: number;
      workflows: ClanBoostWorkflow[];
      reserves: ReserveOption[];
      activations: ClanBoostLogEntry[];
    };

/** Everything the officer console needs: the workflows + live online + reserves. */
export async function loadBoostConsole(
  region: Region,
  userId: string | undefined,
): Promise<BoostConsole> {
  const ctx = await resolveOfficerContext(region, userId);
  if (!ctx.canManage) return ctx;

  const table = clanBoostWorkflowByRegion[region];
  const logTable = clanBoostLogByRegion[region];
  // The workflow rows, the activation log, the live online roster and the
  // reserves are all independent — fetch them together instead of in series.
  const [workflows, activations, info, rawReserves] = await Promise.all([
    db
      .select()
      .from(table)
      .where(eq(table.clanId, ctx.clanId))
      .orderBy(asc(table.createdAt)),
    db
      .select()
      .from(logTable)
      .where(eq(logTable.clanId, ctx.clanId))
      .orderBy(desc(logTable.activatedAt))
      .limit(20),
    wg
      .region(region)
      .api.wot.clans.info({
        clanId: ctx.clanId,
        extra: [ClanInfoExtra.PrivateOnlineMembers],
        accessToken: ctx.token,
      })
      .catch(() => null),
    wg
      .region(region)
      .api.wot.stronghold.clanreserves({ accessToken: ctx.token })
      .catch(() => []),
  ]);

  // Only the sustained economic boosts (Crew XP, credits, Free/Combat XP…) can
  // be activated clan-wide for a duration. `disposable` reserves are the
  // one-shot in-battle combat reserves (Artillery Strike, Inspire, Recon…):
  // they never reach `ready_to_activate` via this endpoint, so they aren't
  // offered as scheduled boosts.
  const reserves: ReserveOption[] = rawReserves
    .filter((r) => !r.disposable)
    .map((r) => ({
      type: r.type,
      bonusType: r.bonus_type,
      name: r.name,
      icon: reserveIconUrl(r.type),
      durationSec:
        Math.max(0, ...r.in_stock.map((s) => s.action_time ?? 0)) || 7200,
      activeUntil: (() => {
        const till = Math.max(0, ...r.in_stock.map((s) => s.active_till ?? 0));
        return till > Math.floor(Date.now() / 1000)
          ? new Date(till * 1000).toISOString()
          : null;
      })(),
      levels: r.in_stock
        .map((s) => {
          // Prefer the Clan-Battles value (skirmishes), else the "All Battles"
          // single value, else whatever is first; ×100 → a percentage.
          const bonus =
            s.bonus_values.find((b) => /clan/i.test(b.battle_type)) ??
            s.bonus_values.find((b) => /all/i.test(b.battle_type)) ??
            s.bonus_values[0];
          return {
            level: s.level,
            amount: s.amount,
            status: s.status,
            percent: bonus ? Math.round(bonus.value * 100) : null,
          };
        })
        .sort((a, b) => a.level - b.level),
    }));

  return {
    canManage: true,
    clanId: ctx.clanId,
    role: ctx.role,
    viewerAccountId: ctx.accountId,
    onlineNow: info?.private?.online_members?.length ?? 0,
    membersCount: info?.members_count ?? 0,
    workflows,
    reserves,
    activations,
  };
}

export type WorkflowInput = {
  name: string;
  enabled: boolean;
  timezone: string;
  days: number;
  windowStart: number;
  windowEnd: number;
  minOnline: number;
  reserves: BoostReserve[];
};

/** Create a new workflow for the officer's own clan. */
export async function createWorkflow(
  region: Region,
  userId: string | undefined,
  input: WorkflowInput,
): Promise<ClanBoostWorkflow | { error: OfficerDenyReason }> {
  const ctx = await resolveOfficerContext(region, userId);
  if (!ctx.canManage) return { error: ctx.reason };
  const [row] = await db
    .insert(clanBoostWorkflowByRegion[region])
    .values({
      clanId: ctx.clanId,
      ownerUserId: userId!,
      ownerAccountId: ctx.accountId,
      ownerName: ctx.name,
      ...input,
    })
    .returning();
  return row;
}

/**
 * Update a workflow by id. Scoped to the officer's own clan (the WHERE checks
 * both id AND clanId), so an officer can't edit another clan's workflow. Editing
 * does NOT change ownership; pass `claim` to make the caller the owner (their
 * token then reads online + activates it) — the "run on my account" action.
 */
export async function updateWorkflow(
  region: Region,
  userId: string | undefined,
  id: string,
  input: WorkflowInput,
  claim = false,
): Promise<ClanBoostWorkflow | { error: OfficerDenyReason | "not_found" }> {
  const ctx = await resolveOfficerContext(region, userId);
  if (!ctx.canManage) return { error: ctx.reason };
  const table = clanBoostWorkflowByRegion[region];
  const [row] = await db
    .update(table)
    .set({
      ...input,
      ...(claim
        ? {
            ownerUserId: userId!,
            ownerAccountId: ctx.accountId,
            ownerName: ctx.name,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(table.id, id), eq(table.clanId, ctx.clanId)))
    .returning();
  return row ?? { error: "not_found" };
}

export enum SimDecision {
  WouldActivate = "would_activate",
  AlreadyActive = "already_active",
  NoStock = "no_stock",
  Unavailable = "unavailable",
}

export type SimReserve = {
  type: string;
  name: string;
  decision: SimDecision;
  level: number | null;
  percent: number | null;
};

export type SimulateResult = {
  onlineNow: number;
  membersCount: number;
  inWindow: boolean;
  minOnline: number;
  thresholdMet: boolean;
  /** True iff, right now, it would actually activate at least one reserve. */
  wouldFire: boolean;
  reserves: SimReserve[];
};

/**
 * Dry-run a workflow config against the LIVE clan right now, ignoring the
 * window/threshold gates but reporting them, and computing what each reserve
 * WOULD do — a safe "test run" for the officer console. No DB writes, never
 * activates anything.
 */
export async function simulateWorkflow(
  region: Region,
  userId: string | undefined,
  input: WorkflowInput,
): Promise<SimulateResult | { error: OfficerDenyReason }> {
  const ctx = await resolveOfficerContext(region, userId);
  if (!ctx.canManage) return { error: ctx.reason };

  const now = new Date();
  const [info, rawReserves] = await Promise.all([
    wg
      .region(region)
      .api.wot.clans.info({
        clanId: ctx.clanId,
        extra: [ClanInfoExtra.PrivateOnlineMembers],
        accessToken: ctx.token,
      })
      .catch(() => null),
    wg
      .region(region)
      .api.wot.stronghold.clanreserves({ accessToken: ctx.token })
      .catch(() => []),
  ]);

  const onlineNow = info?.private?.online_members?.length ?? 0;
  const membersCount = info?.members_count ?? 0;
  const inWindow = isWithinWindow(input, now);
  const thresholdMet = onlineNow >= input.minOnline;
  const reserves = rawReserves.filter((r) => !r.disposable);
  const nowSec = Math.floor(now.getTime() / 1000);

  const decisions: SimReserve[] = input.reserves.map((cfg) => {
    const reserve = reserves.find((r) => r.type === cfg.type);
    if (!reserve) {
      return {
        type: cfg.type,
        name: cfg.type,
        decision: SimDecision.Unavailable,
        level: null,
        percent: null,
      };
    }
    if (reserve.in_stock.some((s) => (s.active_till ?? 0) > nowSec)) {
      return {
        type: reserve.type,
        name: reserve.name,
        decision: SimDecision.AlreadyActive,
        level: null,
        percent: null,
      };
    }
    const ready = reserve.in_stock.filter(
      (s) => s.amount > 0 && s.status === READY,
    );
    if (!ready.length) {
      return {
        type: reserve.type,
        name: reserve.name,
        decision: SimDecision.NoStock,
        level: null,
        percent: null,
      };
    }
    // Mirror the runner: fall back to the LOWEST ready level, not the highest.
    const chosen =
      ready.find((s) => s.level === cfg.level) ??
      [...ready].sort((a, b) => a.level - b.level)[0];
    const bonus =
      chosen.bonus_values.find((b) => /clan/i.test(b.battle_type)) ??
      chosen.bonus_values.find((b) => /all/i.test(b.battle_type)) ??
      chosen.bonus_values[0];
    return {
      type: reserve.type,
      name: reserve.name,
      decision: SimDecision.WouldActivate,
      level: chosen.level,
      percent: bonus ? Math.round(bonus.value * 100) : null,
    };
  });

  return {
    onlineNow,
    membersCount,
    inWindow,
    minOnline: input.minOnline,
    thresholdMet,
    wouldFire:
      inWindow &&
      thresholdMet &&
      decisions.some((d) => d.decision === SimDecision.WouldActivate),
    reserves: decisions,
  };
}

/** Delete a workflow by id, scoped to the officer's own clan. */
export async function deleteWorkflow(
  region: Region,
  userId: string | undefined,
  id: string,
): Promise<{ ok: boolean; error?: OfficerDenyReason }> {
  const ctx = await resolveOfficerContext(region, userId);
  if (!ctx.canManage) return { ok: false, error: ctx.reason };
  const table = clanBoostWorkflowByRegion[region];
  await db
    .delete(table)
    .where(and(eq(table.id, id), eq(table.clanId, ctx.clanId)));
  return { ok: true };
}
