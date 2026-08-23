"use client";

import useSWR from "swr";
import { TankClient, type TankSpec, type VehicleMode } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { TankConfig } from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { TankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { TankFieldMods } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type { TankSkillTree } from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import { unicum } from "@/services/sdk";

/** Everything the configurator builds a vehicle from, on one game client. */
export type TankBuildSources = {
  stockSpecs: TankSpec | null;
  modules: TankModuleNode[];
  configs: TankConfig[];
  loadout: TankLoadout | null;
  crew: TankCrew | null;
  fieldMods: TankFieldMods | null;
  skillTree: TankSkillTree | null;
  modes: VehicleMode[];
};

/**
 * The vehicle as the running Common Test has it, fetched on demand.
 *
 * Client-side rather than rendered with the page, for two reasons that point the
 * same way: the tank page is statically cached per slug, so a payload chosen by
 * a query param cannot be baked into it, and the test client is a deliberate
 * detour most readers never take. It is fetched the first time someone asks for
 * it and kept for the rest of the visit.
 *
 * A failure leaves the caller on the live client rather than emptying the page:
 * the test build is a bonus view of a vehicle whose real characteristics are
 * already on screen.
 */
export function useTestBuild(
  region: Region,
  slug: string,
  enabled: boolean,
): {
  data: TankBuildSources | null;
  pending: boolean;
  failed: boolean;
  /** Ask again after a failure. SWR does not retry this one on its own. */
  retry: () => void;
} {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? `tank-detail:${region}:${slug}:${TankClient.CommonTest}` : null,
    () =>
      unicum
        .region(region)
        .tanks(slug)
        .detail(TankClient.CommonTest)
        .then(
          (r): TankBuildSources => ({
            stockSpecs: r.specs as unknown as TankSpec | null,
            modules: r.modules as unknown as TankModuleNode[],
            configs: r.configs as unknown as TankConfig[],
            loadout: r.loadout as unknown as TankLoadout | null,
            crew: r.crew as unknown as TankCrew | null,
            fieldMods: r.fieldMods as unknown as TankFieldMods | null,
            skillTree: r.skillTree as unknown as TankSkillTree | null,
            modes: (r.modes ?? []) as unknown as VehicleMode[],
          }),
        ),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  return {
    data: data ?? null,
    pending: isLoading,
    failed: Boolean(error),
    retry: () => void mutate(),
  };
}
