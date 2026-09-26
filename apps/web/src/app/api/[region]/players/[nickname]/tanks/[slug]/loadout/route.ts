import { isRegion } from "@unicum.gg/wargaming";
import { isSkillTree, type StoredPlayerLoadout } from "@unicum.gg/shared";
import { getPlayerTankLoadout } from "@unicum.gg/core/tanks/loadout-read";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { PlayerTankLoadoutResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Player vehicle loadout
 * @description How one player has set one vehicle up: its modules, its crew's skills, its field modifications, and what it carries into battle, ammunition counts and secondary setups included. Wargaming publishes none of this about anyone, so a loadout exists only because that player runs the unicum.gg mod, which reads it from their own client and sends it up. `loadout` is null when we hold nothing for the pair, which is also the answer for a player who asked for their loadouts not to be shown.
 * @pathParams playerTankParams
 * @response PlayerTankLoadoutResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/tanks/{slug}/loadout", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  _req: Request,
  {
    params,
  }: { params: Promise<{ region: string; nickname: string; slug: string }> },
) {
  const { region, nickname, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const decoded = decodeURIComponent(nickname);

  try {
    const stored = await getPlayerTankLoadout(region, decoded, slug);
    return jsonResponse(PlayerTankLoadoutResponse, {
      loadout: stored ? wire(stored) : null,
    });
  } catch (err) {
    console.error(
      `[api/${region}/players/${decoded}/tanks/${slug}/loadout] failed:`,
      err,
    );
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}

/**
 * The stored shape, flattened for the wire.
 *
 * The two progressions are one object here rather than a union, because a
 * union of two objects is exactly what the OpenAPI generator cannot read and
 * what a typed client then cannot narrow. A field-modified vehicle carries
 * `level` and `pairs`; a tier XI one carries `tree` and leaves the other two
 * empty, which is a shape a caller can branch on without a discriminator.
 */
function wire(stored: StoredPlayerLoadout) {
  const progression = stored.progression;
  return {
    tankId: stored.tankId,
    modules: {
      gun: stored.modules?.gun ?? null,
      turret: stored.modules?.turret ?? null,
      engine: stored.modules?.engine ?? null,
      chassis: stored.modules?.chassis ?? null,
      radio: stored.modules?.radio ?? null,
    },
    crew: stored.crew ?? [],
    progression: progression
      ? {
          level: isSkillTree(progression) ? null : progression.level,
          pairs: isSkillTree(progression) ? [] : progression.pairs,
          tree: isSkillTree(progression) ? progression.tree : [],
        }
      : null,
    setups: {
      ammo: stored.setups?.ammo ?? null,
      devices: stored.setups?.devices ?? null,
    },
    updatedAt: stored.updatedAt.toISOString(),
  };
}
