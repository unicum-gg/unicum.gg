import { containerAgeSeconds, containerLogs, findContainer } from "./docker";
import { readRule, setRuleEnabled, type RuleConfig } from "./cloudflare";

/**
 * Turns the site's Cloudflare challenge on only while the origin is actually
 * being hurt, and off the rest of the time.
 *
 * The challenge has been on permanently since a scraper came through
 * distributed proxies and tripled our request rate. Permanently is expensive:
 * it turns away every crawler Cloudflare has not blessed (an SEO audit tool, a
 * monitoring service) and shows a checkbox to real readers, and it buys nothing
 * on the overwhelming majority of days when nobody is attacking us.
 *
 * What this does NOT try to do is detect an attack. Volume cannot tell one
 * apart from a streamer linking us, and the attempt was abandoned after
 * measuring: today's ordinary Saturday traffic burns more CPU (553% sustained)
 * than the attack did (473%), so any threshold drawn from the attack would fire
 * every evening. The question worth answering is not "is this an attack" but
 * "are we failing", because a challenge is justified in exactly that case and
 * in no other, whatever the cause.
 */

const MODE = (process.env.SENTINEL_MODE ?? "observe") as "observe" | "enforce";
const WEB_PREFIX = process.env.WEB_CONTAINER_PREFIX ?? "";
const POLL_SECONDS = Number(process.env.SENTINEL_POLL_SECONDS) || 60;

/**
 * The signal: how many times the web's event loop stalled in the window.
 *
 * The web already logs this, and it says precisely "the process could not keep
 * up", which is the thing we want to act on. It is also the one signal that a
 * storage failure does not forge: a slow query is awaited, so it blocks nothing,
 * whereas rendering pages nobody asked for blocks everything. Load average
 * cannot make that distinction, and during the September disk collapse it sat at
 * 105 with no attacker anywhere.
 */
const WINDOW_MINUTES = Number(process.env.SENTINEL_WINDOW_MINUTES) || 5;

/**
 * How many stalls in the window count as the web struggling.
 *
 * Six, and the number is measured rather than reasoned. It was three at first,
 * from a baseline of 5 stalls in 24 hours read off a long-running container, and
 * five hours of observing a real afternoon demolished it: 38 of 241 readings
 * reached three, and the sentinel would have flipped the challenge on and off
 * EIGHTY times, which a reader experiences as a checkbox that will not go away.
 *
 * Over those 241 readings the distribution is 0:101 1:61 2:40 3:22 4:9 5:7 6:2,
 * so six is the edge of what an ordinary afternoon produces and seven never
 * happened at all.
 */
const STALL_THRESHOLD = Number(process.env.SENTINEL_STALL_THRESHOLD) || 6;

/**
 * How many readings in a row must be over the threshold before acting.
 *
 * A single bad window is a blip: a slow revalidation, one expensive page, a
 * garbage collection that ran long. An attack does not stop after one minute.
 * Requiring three consecutive takes the same afternoon from six would-be
 * triggers at the old threshold to ZERO at this one, without making the rule
 * any slower than three minutes to react.
 */
const SUSTAIN_READINGS = Number(process.env.SENTINEL_SUSTAIN_READINGS) || 3;

/**
 * How long the origin must look healthy before the challenge comes back off.
 *
 * Longer than the window that turns it on, deliberately: flapping is worse than
 * either state, because every flip either lets an attacker back in or bounces a
 * reader into a checkbox they had just cleared.
 */
const CALM_MINUTES = Number(process.env.SENTINEL_CALM_MINUTES) || 20;

/**
 * How long after a deployment the web is left alone.
 *
 * Ten minutes, which is comfortably past the warm-up burst measured on a fresh
 * container: its caches fill, its heap grows from half a gigabyte to one and a
 * half, and the event loop stalls a handful of times doing it. None of that is
 * distress and none of it is traffic we should be shedding.
 */
const WARMUP_SECONDS = Number(process.env.SENTINEL_WARMUP_SECONDS) || 600;

const STALL_PATTERN = /event-loop-lag/;

function ruleConfig(): RuleConfig | null {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const rulesetId = process.env.CLOUDFLARE_RULESET_ID;
  const ruleId = process.env.CLOUDFLARE_RULE_ID;
  if (!token || !zoneId || !rulesetId || !ruleId) return null;
  return { token, zoneId, rulesetId, ruleId };
}

async function countStalls(containerId: string): Promise<number> {
  const since = Math.floor(Date.now() / 1000) - WINDOW_MINUTES * 60;
  const lines = await containerLogs(containerId, since);
  return lines.filter((l) => STALL_PATTERN.test(l)).length;
}

let calmTicks = 0;
let struggleTicks = 0;

async function tick(cfg: RuleConfig | null): Promise<void> {
  const containerId = await findContainer(WEB_PREFIX);
  if (!containerId) {
    console.warn(`[sentinel] no running container matching "${WEB_PREFIX}"`);
    return;
  }

  const age = await containerAgeSeconds(containerId);
  if (age < WARMUP_SECONDS) {
    console.log(
      `[sentinel] web started ${Math.round(age)}s ago, warming up, skipping`,
    );
    return;
  }

  const stalls = await countStalls(containerId);
  const overThreshold = stalls >= STALL_THRESHOLD;
  struggleTicks = overThreshold ? struggleTicks + 1 : 0;
  const struggling = struggleTicks >= SUSTAIN_READINGS;
  calmTicks = overThreshold ? 0 : calmTicks + 1;

  // Asymmetric on purpose: one window of trouble turns it on, many quiet ones
  // turn it off. Being slow to relax is cheap, being slow to react is not.
  const wanted = struggling || calmTicks * POLL_SECONDS < CALM_MINUTES * 60;

  if (!cfg) {
    console.warn(`[sentinel] ${stalls} stalls in ${WINDOW_MINUTES}m, cloudflare not configured`);
    return;
  }

  const current = (await readRule(cfg)).enabled ?? true;

  // Every tick, not only the ones that would act. Observe mode exists to be
  // read before anyone trusts the threshold, and a watcher that stays silent
  // while it agrees with itself gives nothing to read: the first time it says
  // anything would also be the first time it is about to do something, which is
  // the worst moment to discover you disagree with it.
  console.log(
    `[sentinel] stalls=${stalls}/${WINDOW_MINUTES}m over=${struggleTicks}/${SUSTAIN_READINGS} struggling=${struggling} calm=${Math.round((calmTicks * POLL_SECONDS) / 60)}m rule=${current ? "on" : "off"} wants=${wanted ? "on" : "off"}`,
  );

  if (current === wanted) return;

  if (MODE === "observe") {
    console.log(
      `[sentinel] WOULD ${wanted ? "enable" : "disable"} the challenge (${stalls} stalls in ${WINDOW_MINUTES}m, rule is ${current ? "on" : "off"})`,
    );
    return;
  }

  const changed = await setRuleEnabled(cfg, wanted);
  if (changed) {
    console.log(
      `[sentinel] challenge ${wanted ? "ENABLED" : "disabled"} (${stalls} stalls in ${WINDOW_MINUTES}m)`,
    );
  }
}

async function main(): Promise<void> {
  const cfg = ruleConfig();
  console.log(
    `[sentinel] mode=${MODE} window=${WINDOW_MINUTES}m threshold=${STALL_THRESHOLD} calm=${CALM_MINUTES}m cloudflare=${cfg ? "configured" : "absent"}`,
  );
  if (MODE === "observe") {
    console.log("[sentinel] observe mode: nothing will be changed at Cloudflare");
  }
  for (;;) {
    try {
      await tick(cfg);
    } catch (err) {
      // Never let one bad poll end the process: the sentinel is least useful
      // exactly when things are breaking, which is when a poll is most likely
      // to throw.
      console.error("[sentinel] tick failed:", err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
  }
}

void main();
