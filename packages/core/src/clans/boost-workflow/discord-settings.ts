import { eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { sendTestNotification } from "@unicum.gg/core/discord";
import {
  type ClanBoostDiscord,
  clanBoostDiscordByRegion,
  clansByRegion,
} from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";
import { resolveOfficerContext, type OfficerDenyReason } from "./console";

export type DiscordDestInput = {
  guildId: string;
  channelId: string;
  guildName: string;
  channelName: string;
};

export type DiscordSettings =
  | { canManage: false; reason: OfficerDenyReason }
  | { canManage: true; clanId: number; destination: ClanBoostDiscord | null };

/** The clan's current Discord destination + whether the caller may manage it. */
export async function getDiscordSettings(
  region: Region,
  userId: string | undefined,
): Promise<DiscordSettings> {
  const ctx = await resolveOfficerContext(region, userId);
  if (!ctx.canManage) return { canManage: false, reason: ctx.reason };
  const [destination] = await db
    .select()
    .from(clanBoostDiscordByRegion[region])
    .where(eq(clanBoostDiscordByRegion[region].clanId, ctx.clanId))
    .limit(1);
  return { canManage: true, clanId: ctx.clanId, destination: destination ?? null };
}

/** Set (upsert) the clan's Discord destination. Officer only. */
export async function saveDiscordDestination(
  region: Region,
  userId: string | undefined,
  input: DiscordDestInput,
): Promise<ClanBoostDiscord | { error: OfficerDenyReason }> {
  const ctx = await resolveOfficerContext(region, userId);
  if (!ctx.canManage) return { error: ctx.reason };
  const table = clanBoostDiscordByRegion[region];
  const [row] = await db
    .insert(table)
    .values({ clanId: ctx.clanId, ...input, setByUserId: userId! })
    .onConflictDoUpdate({
      target: table.clanId,
      set: { ...input, setByUserId: userId!, updatedAt: new Date() },
    })
    .returning();
  return row;
}

/** Remove the clan's Discord destination. Officer only. */
export async function removeDiscordDestination(
  region: Region,
  userId: string | undefined,
): Promise<{ ok: boolean; error?: OfficerDenyReason }> {
  const ctx = await resolveOfficerContext(region, userId);
  if (!ctx.canManage) return { ok: false, error: ctx.reason };
  await db
    .delete(clanBoostDiscordByRegion[region])
    .where(eq(clanBoostDiscordByRegion[region].clanId, ctx.clanId));
  return { ok: true };
}

/** Post a test message to the clan's configured channel. Officer only. */
export async function sendDiscordTest(
  region: Region,
  userId: string | undefined,
): Promise<{ ok: boolean; error?: OfficerDenyReason | "no_destination" | "failed" }> {
  const ctx = await resolveOfficerContext(region, userId);
  if (!ctx.canManage) return { ok: false, error: ctx.reason };
  const [dest] = await db
    .select()
    .from(clanBoostDiscordByRegion[region])
    .where(eq(clanBoostDiscordByRegion[region].clanId, ctx.clanId))
    .limit(1);
  if (!dest) return { ok: false, error: "no_destination" };
  const [clan] = await db
    .select({ tag: clansByRegion[region].tag })
    .from(clansByRegion[region])
    .where(eq(clansByRegion[region].id, ctx.clanId))
    .limit(1);
  const ok = await sendTestNotification(dest.channelId, clan?.tag ?? String(ctx.clanId));
  return ok ? { ok: true } : { ok: false, error: "failed" };
}
