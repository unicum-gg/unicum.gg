import { eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { wg } from "@unicum.gg/core/wargaming/client";
import { getWargamingAccessToken } from "@unicum.gg/core/auth/wargaming-token";
import { sendBoostNotification } from "@unicum.gg/core/discord";
import {
  APP_IDENTITY,
  BoostWorkflowStatus,
  clanBoostDiscordByRegion,
  clanBoostLogByRegion,
  clanBoostWorkflowByRegion,
  clansByRegion,
  type ClanBoostWorkflow,
  type NewClanBoostLogEntry,
} from "@unicum.gg/shared";
import { ClanInfoExtra, Region } from "@unicum.gg/wargaming";

const READY = "ready_to_activate";

export enum BoostOutcome {
  Activated = "activated",
  WouldActivate = "would_activate",
  OutOfWindow = "out_of_window",
  BelowThreshold = "below_threshold",
  NothingToActivate = "nothing_to_activate",
  TokenExpired = "token_expired",
  Error = "error",
}

export type ActivatedReserve = { type: string; level: number };

export type EvaluateResult = {
  clanId: number;
  outcome: BoostOutcome;
  onlineCount?: number;
  activated?: ActivatedReserve[];
  error?: string;
};

/** Local-time window check in the workflow's timezone (bitmask Mon=bit0…Sun=bit6). */
export function isWithinWindow(
  workflow: {
    timezone: string;
    days: number;
    windowStart: number;
    windowEnd: number;
  },
  now: Date,
): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: workflow.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
    get("weekday"),
  );
  if (dayIndex < 0 || (workflow.days & (1 << dayIndex)) === 0) return false;
  // "24" at midnight in some locales → normalize to 0.
  const hour = Number(get("hour")) % 24;
  const minutes = hour * 60 + Number(get("minute"));
  return minutes >= workflow.windowStart && minutes < workflow.windowEnd;
}

async function patch(
  region: Region,
  id: string,
  values: Partial<ClanBoostWorkflow>,
): Promise<void> {
  await db
    .update(clanBoostWorkflowByRegion[region])
    .set({ ...values, updatedAt: new Date() })
    .where(eq(clanBoostWorkflowByRegion[region].id, id));
}

/** Post a Discord notification for a tick's activations, if the clan wired up a
 * destination. Best-effort — a Discord failure never fails the activation. */
async function notifyActivation(
  region: Region,
  clanId: number,
  workflowName: string,
  onlineCount: number,
  rows: NewClanBoostLogEntry[],
): Promise<void> {
  try {
    const [dest] = await db
      .select()
      .from(clanBoostDiscordByRegion[region])
      .where(eq(clanBoostDiscordByRegion[region].clanId, clanId))
      .limit(1);
    if (!dest) return;
    const [clan] = await db
      .select({ tag: clansByRegion[region].tag })
      .from(clansByRegion[region])
      .where(eq(clansByRegion[region].id, clanId))
      .limit(1);
    const tag = clan?.tag ?? String(clanId);
    await sendBoostNotification(dest.channelId, {
      clanTag: tag,
      clanUrl: `${APP_IDENTITY.URL}/${region}/clans/${encodeURIComponent(tag)}`,
      workflowName,
      onlineCount,
      reserves: rows.map((r) => ({
        name: r.reserveName,
        level: r.reserveLevel,
        percent: r.percent ?? null,
      })),
    });
  } catch {
    // Discord is best-effort; never break the run over it.
  }
}

/**
 * Evaluate one clan's boost workflow against the live online roster and
 * activate the configured Stronghold reserves when it fires. Pass `dryRun` to
 * compute the decision (and record the online count) without ever calling
 * `activateclanreserve`.
 */
export async function evaluateWorkflow(
  region: Region,
  workflow: ClanBoostWorkflow,
  opts: { dryRun?: boolean; now?: Date } = {},
): Promise<EvaluateResult> {
  const now = opts.now ?? new Date();
  const dryRun = opts.dryRun ?? false;
  const clanId = workflow.clanId;
  const id = workflow.id;

  const token = await getWargamingAccessToken(workflow.ownerUserId);
  if (!token.ok) {
    const status =
      token.reason === "expired"
        ? BoostWorkflowStatus.TokenExpired
        : BoostWorkflowStatus.Error;
    await patch(region, id, {
      status,
      lastError: token.reason,
      lastCheckedAt: now,
    });
    return {
      clanId,
      outcome:
        token.reason === "expired"
          ? BoostOutcome.TokenExpired
          : BoostOutcome.Error,
      error: token.reason,
    };
  }

  if (!isWithinWindow(workflow, now)) {
    await patch(region, id, { lastCheckedAt: now });
    return { clanId, outcome: BoostOutcome.OutOfWindow };
  }

  // A roster fetch that throws (WG throttle / G-Core block) must NOT be recorded
  // as a healthy "0 online", that would read as a genuinely empty clan. Treat a
  // failed/absent roster as an error and skip this tick instead.
  const info = await wg
    .region(region)
    .api.wot.clans.info({
      clanId,
      extra: [ClanInfoExtra.PrivateOnlineMembers],
      accessToken: token.token,
    })
    .catch(() => null);
  if (!info) {
    await patch(region, id, {
      lastCheckedAt: now,
      status: BoostWorkflowStatus.Error,
      lastError: "roster_unavailable",
    });
    return { clanId, outcome: BoostOutcome.Error, error: "roster_unavailable" };
  }
  const onlineCount = info.private?.online_members?.length ?? 0;

  if (onlineCount < workflow.minOnline) {
    await patch(region, id, {
      lastOnlineCount: onlineCount,
      lastCheckedAt: now,
      status: BoostWorkflowStatus.Ok,
      lastError: null,
    });
    return { clanId, outcome: BoostOutcome.BelowThreshold, onlineCount };
  }

  const reserves = await wg
    .region(region)
    .api.wot.stronghold.clanreserves({ accessToken: token.token })
    .catch(() => []);
  const nowSec = Math.floor(now.getTime() / 1000);
  const activated: ActivatedReserve[] = [];
  const logRows: NewClanBoostLogEntry[] = [];

  for (const cfg of workflow.reserves) {
    const reserve = reserves.find((r) => r.type === cfg.type);
    if (!reserve) continue;
    // Don't stack: skip if any level of this reserve is already running.
    if (reserve.in_stock.some((s) => (s.active_till ?? 0) > nowSec)) continue;
    const ready = reserve.in_stock.filter(
      (s) => s.amount > 0 && s.status === READY,
    );
    if (!ready.length) continue;
    // Prefer the configured level; if it isn't ready, fall back to the LOWEST
    // available level rather than the highest, so we never burn a costlier
    // reserve than the officer asked for.
    const chosen =
      ready.find((s) => s.level === cfg.level) ??
      [...ready].sort((a, b) => a.level - b.level)[0];

    if (!dryRun) {
      await wg
        .region(region)
        .api.wot.stronghold.activateClanReserve({
          accessToken: token.token,
          reserveType: reserve.type,
          reserveLevel: chosen.level,
        });
      // Prefer the Clan-Battles bonus (what skirmishes count as); ×100 → percent.
      const bonus =
        chosen.bonus_values.find((b) => /clan/i.test(b.battle_type)) ??
        chosen.bonus_values.find((b) => /all/i.test(b.battle_type)) ??
        chosen.bonus_values[0];
      logRows.push({
        clanId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        reserveType: reserve.type,
        reserveName: reserve.name,
        reserveLevel: chosen.level,
        percent: bonus ? Math.round(bonus.value * 100) : null,
        onlineCount,
        activatedAt: now,
      });
    }
    activated.push({ type: reserve.type, level: chosen.level });
  }

  if (logRows.length) {
    await db.insert(clanBoostLogByRegion[region]).values(logRows);
    await notifyActivation(region, clanId, workflow.name, onlineCount, logRows);
  }

  await patch(region, id, {
    lastOnlineCount: onlineCount,
    lastCheckedAt: now,
    lastActivatedAt:
      activated.length && !dryRun ? now : workflow.lastActivatedAt,
    status: BoostWorkflowStatus.Ok,
    lastError: null,
  });

  return {
    clanId,
    outcome: activated.length
      ? dryRun
        ? BoostOutcome.WouldActivate
        : BoostOutcome.Activated
      : BoostOutcome.NothingToActivate,
    onlineCount,
    activated,
  };
}

/** Evaluate every enabled workflow in a region (the worker job entrypoint). */
export async function runRegionBoostWorkflows(
  region: Region,
  opts: { dryRun?: boolean } = {},
): Promise<EvaluateResult[]> {
  const table = clanBoostWorkflowByRegion[region];
  const workflows = await db
    .select()
    .from(table)
    .where(eq(table.enabled, true));
  const results: EvaluateResult[] = [];
  for (const workflow of workflows) {
    // Isolate each workflow: an activation that throws (WG throttle, token
    // race) must not skip every workflow ordered after it this tick.
    try {
      results.push(await evaluateWorkflow(region, workflow, opts));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await patch(region, workflow.id, {
        status: BoostWorkflowStatus.Error,
        lastError: error,
        lastCheckedAt: new Date(),
      }).catch(() => {});
      results.push({
        clanId: workflow.clanId,
        outcome: BoostOutcome.Error,
        error,
      });
    }
  }
  return results;
}
