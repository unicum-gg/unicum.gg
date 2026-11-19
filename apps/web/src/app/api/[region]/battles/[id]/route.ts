import { isRegion } from "@unicum.gg/wargaming";
import { battleDetail } from "@unicum.gg/core/battles/read";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import { jsonResponse } from "@/services/openapi/json-response";
import { BattleDetailResponse } from "./schema.api";
import { measured } from "@/services/perf";
import { contentLanguage, interfaceLanguage } from "@/services/openapi/locale";
import { nameBattleLoadouts } from "@/services/battles/loadouts";
import { nameBattleMedals } from "@/services/battles/medals";
import { getAllTankSpecs } from "@unicum.gg/core/wargaming/wot/tanks/specs";
import { battleVision } from "@/services/battles/vision";
import { gameCatalogueLanguage } from "@/lib/game-vocabulary";

/**
 * Battle
 * @description One whole battle: every vehicle on both teams, each one named where this site holds the account and each one rated on this battle alone against its own vehicle's expected values, with what a recording of it said they had fitted, named in the requested language. Wargaming publishes nothing about a single battle, so a battle exists here only because somebody who was in it shared it through the unicum.gg mod. 404 when we hold no such battle.
 * @pathParams battleParams
 * @queryParams battleDetailQuery
 * @response BattleDetailResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/battles/{id}", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string; id: string }> },
) {
  const { region, id } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  if (!/^[0-9]{1,20}$/.test(id)) {
    return Response.json({ error: "invalid_battle" }, { status: 400 });
  }

  try {
    const battle = await battleDetail(region, normaliseBattleId(id));
    if (!battle) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const served = interfaceLanguage(req);
    const [named, specs] = await Promise.all([
      nameBattleLoadouts(region, served, battle.participants),
      getAllTankSpecs(),
    ]);
    // The view range the replay rings its focused vehicle with: the top
    // configuration's for everybody, and the real one, with crew and devices,
    // for whoever we hold the whole loadout of (the recorders).
    const visions = new Map(
      await Promise.all(
        battle.participants.map(async (one) => {
          const loadout = one.loadouts?.[0];
          const tankId = loadout?.tankId ?? one.tank?.id;
          const spec = tankId ? specs.get(tankId) : undefined;
          if (!loadout || !tankId || !spec) return [one.id, null] as const;
          const vision = await battleVision(region, tankId, spec, loadout).catch(() => null);
          return [one.id, vision] as const;
        }),
      ),
    );
    const participants = named.map((one) =>
      one.tank
        ? {
            ...one,
            tank: { ...one.tank, viewRange: specs.get(one.tank.id)?.viewRange ?? null },
            vision: visions.get(one.id) ?? null,
          }
        : one,
    );
    // A battle never changes once it has been played, so this is as cacheable
    // as anything on the site. `s-maxage` rather than `max-age`: the shared
    // cache keeps it for an hour, and a reader's own browser revalidates, so a
    // change to what this endpoint answers reaches them on their next visit
    // instead of an hour later. The only thing that moves is `reporters`, when
    // a second client reports the same battle. The loadouts are named in one
    // language, which is safe in a shared cache because that language is in
    // the URL rather than in a cookie.
    // Named in the game's own words, which Wargaming answers in fewer
    // languages than the interface: its own fallback, not the loadouts'.
    const medals = await nameBattleMedals(
      region,
      gameCatalogueLanguage(req).language,
      battle.participants.flatMap((one) => one.medals ?? []),
    );
    return jsonResponse(
      BattleDetailResponse,
      { ...battle, participants, medals, startedAt: battle.startedAt.toISOString() },
      contentLanguage(served, {
        headers: {
          "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
        },
      }),
    );
  } catch (err) {
    console.error(`[api/${region}/battles/${id}] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
