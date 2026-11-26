import { UsageMetric } from "@unicum.gg/shared";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { countBotGuilds } from "@unicum.gg/core/discord";
import { setUsageGauge } from "./record";

// Hourly, on a minute no other hourly job holds. The figure moves on the order
// of days, but Discord only ever answers "now", so a day the worker was down at
// the one sampling minute would be a hole in the curve; twenty-four chances a
// day make that nearly impossible, at one Discord call an hour.
const USAGE_SAMPLE_SCHEDULE = "7 * * * *";

/**
 * Record today's reading of the figures nobody else keeps a history of. Only
 * the bot's server count needs it today: the site's activity is written as it
 * happens and the bot's commands are counted as they arrive.
 *
 * A failed read writes nothing rather than a zero, for the reason the servers'
 * sampler gives: a zero is indistinguishable from the bot having been removed
 * everywhere, and the day keeps its last good reading.
 */
export async function sampleUsage(): Promise<void> {
  const guilds = await countBotGuilds();
  if (guilds === null) {
    console.warn("[usage-sample-cron] Discord did not answer, nothing written");
    return;
  }
  await setUsageGauge(UsageMetric.BotGuilds, guilds);
  console.log(`[usage-sample-cron] bot in ${guilds} servers`);
}

export function startUsageSampleCron(): void {
  scheduleCron("usage-sample-cron", USAGE_SAMPLE_SCHEDULE, sampleUsage);
}
