import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { listTanks } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { assembleTankDetail } from "@unicum.gg/core/wargaming/wot/tanks/detail-assemble";
import { setCachedTankDetailJson } from "@unicum.gg/core/wargaming/wot/tanks/detail-cache";
import { REGIONS, type Region } from "@unicum.gg/wargaming";

// Daily at 08:00, after the tank-data crons (vehicles 07:00, top-players-by-tank
// 03:30, MoE/MoM). The tank-detail endpoint caches its ~16-source payload in
// Redis, but only lazily — the first visitor of each tank pays the 0.5-2.9s
// assembly, and an unvisited tank is always cold. This walks the whole catalogue
// and re-assembles every tank's payload proactively, so navigation to any tank is
// instant off the cache, not just recently-viewed ones. Because it assembles
// natively and overwrites the entry, it always refreshes (no bust needed).
const SCHEDULE = "0 8 * * *";
// Gentle: each re-assembly hits WG + the external wot-src / Poliroid providers,
// so keep concurrency low to never compete with live traffic or trip their limits.
const CONCURRENCY = 3;

async function warmRegion(
  region: Region,
): Promise<{ ok: number; fail: number }> {
  const tanks = await listTanks(region);
  const slugs = tanks.map((t) => t.slug);
  let ok = 0;
  let fail = 0;
  let cursor = 0;
  async function pump(): Promise<void> {
    while (cursor < slugs.length) {
      const slug = slugs[cursor++];
      try {
        const payload = await assembleTankDetail(region, slug);
        if (!payload) {
          fail++;
          continue;
        }
        await setCachedTankDetailJson(region, slug, JSON.stringify(payload));
        ok++;
      } catch {
        // Best-effort: a failed tank just stays lazily cached on first visit.
        fail++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => pump()));
  return { ok, fail };
}

export function startTankWarmCron(): void {
  scheduleCron("tank-warm cron", SCHEDULE, async () => {
    for (const region of REGIONS) {
      const start = Date.now();
      const { ok, fail } = await warmRegion(region);
      console.log(
        `[tank-warm cron] ${region}: warmed ${ok}, failed ${fail} in ${Date.now() - start}ms`,
      );
    }
  });
}
