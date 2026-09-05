"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  BATTLE_RESULT_LABEL,
  BattleResult,
  MAP_GAME_MODE_LABEL,
  MapGameMode,
  SPAWN_DIRECTION_LABEL,
  spawnDirection,
  type MapDetail,
  type MapSummary,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { MinimapImage } from "@/components/maps/minimap-image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { unicum } from "@/services/sdk";

/** Where the battle was played and how it ended. Held as one value because the
 * four move together: they are filled in one pass and cleared in one. */
export type BattleContext = {
  arenaId: string;
  mode: string;
  spawnTeam: string;
  result: string;
};

export const EMPTY_BATTLE: BattleContext = {
  arenaId: "",
  mode: "",
  spawnTeam: "",
  result: "",
};

/** Stable reference while the catalogue loads, so the selector's memo inputs do
 * not change identity every render. */
const EMPTY_MAPS: MapSummary[] = [];

/** Nothing left blank, so the row can be filtered and a moderator has something
 * to check the video against. */
export function isBattleComplete(battle: BattleContext): boolean {
  return Boolean(
    battle.arenaId && battle.mode && battle.spawnTeam && battle.result,
  );
}

/**
 * The battle context of a suggestion: map, mode, spawn side and outcome.
 *
 * Every field is a constrained choice rather than free text. The map comes from
 * our own catalogue and the modes offered are the ones that map actually runs,
 * so a battle cannot be filed under a mode that never happens there. That is
 * worth more than a text field, because these values feed the filters and a
 * moderator has to check each one against the video.
 */
export function BattleFields({
  region,
  value,
  onChange,
}: {
  region: Region;
  value: BattleContext;
  onChange: (patch: Partial<BattleContext>) => void;
}) {
  // Fetched here rather than handed down from the page. The catalogue is 23 KB
  // and exists only for this selector, so shipping it in every tank page's
  // payload would charge everyone for a form almost nobody opens. Cached by
  // SWR, so opening the form twice costs one request.
  const { data: maps = EMPTY_MAPS } = useSWR(`maps:${region}`, () =>
    unicum
      .region(region)
      .maps.list()
      .then((r) => r.results as unknown as MapSummary[]),
  );
  const selectedMap = maps.find((m) => m.arenaId === value.arenaId);
  // Only the modes this map runs, so the pair cannot contradict itself.
  const modes = selectedMap?.modes ?? [];
  const teamLabel = useSpawnLabels(region, selectedMap, value.mode);

  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Map</span>
        {/* `w-full` on every trigger overrides the primitive's `w-fit`, which
            sizes to the current value and left the four controls ragged. */}
        <Select
          value={value.arenaId}
          onValueChange={(v) => onChange({ arenaId: v, mode: "" })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue
              placeholder={maps.length === 0 ? "Loading maps…" : "Pick a map"}
            />
          </SelectTrigger>
          <SelectContent>
            {maps.map((m) => (
              <SelectItem key={m.arenaId} value={m.arenaId}>
                <MapOption map={m} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Mode</span>
        <Select
          value={value.mode}
          onValueChange={(v) => onChange({ mode: v })}
          disabled={modes.length === 0}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Pick a mode" />
          </SelectTrigger>
          <SelectContent>
            {modes.map((m) => (
              <SelectItem key={m} value={m}>
                {MAP_GAME_MODE_LABEL[m as MapGameMode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {/* The team, not the compass: a player remembers which side of the
            minimap they started on, and the direction is worked out from the
            map's own geometry. */}
        <span className="font-medium">Spawn</span>
        <Select
          value={value.spawnTeam}
          onValueChange={(v) => onChange({ spawnTeam: v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Which side you started" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">{teamLabel(1)}</SelectItem>
            <SelectItem value="2">{teamLabel(2)}</SelectItem>
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Result</span>
        <Select
          value={value.result}
          onValueChange={(v) => onChange({ result: v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="How it ended" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(BattleResult).map((r) => (
              <SelectItem key={r} value={r}>
                {BATTLE_RESULT_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}

/**
 * Names the two spawn sides of the picked map: "Team 1 · South".
 *
 * "Team 1" is the game's own numbering and means nothing to most players, which
 * is the whole reason the map's geometry is fetched: they know they started at
 * the bottom of the minimap, not that they were team 1. The side depends on the
 * mode, so the label is only complete once both are picked.
 */
function useSpawnLabels(
  region: Region,
  selectedMap: MapSummary | undefined,
  mode: string,
): (team: 1 | 2) => string {
  // Stored with the map it describes, and read back only while the two agree.
  // Clearing it on every map change would mean writing state from the effect
  // body, and would still leave the previous map's geometry on screen for the
  // length of the fetch. Tagging covers both, and settles the race where a slow
  // response for an abandoned map lands after a faster one.
  const [detail, setDetail] = useState<MapDetail | null>(null);
  useEffect(() => {
    if (!selectedMap) return;
    let cancelled = false;
    void unicum
      .region(region)
      .maps(selectedMap.slug)
      .detail()
      .then((d) => {
        if (!cancelled) setDetail(d as unknown as MapDetail);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [region, selectedMap]);

  const geometryFor =
    detail && detail.arenaId === selectedMap?.arenaId ? detail : null;

  return (team) => {
    const geometry = geometryFor?.geometry.find((g) => g.mode === mode);
    const direction = geometry ? spawnDirection(geometry, team) : null;
    return direction
      ? `Team ${team} · ${SPAWN_DIRECTION_LABEL[direction]}`
      : `Team ${team}`;
  };
}

/**
 * A map in the selector, shown with its minimap.
 *
 * Names alone are a memory test: the game shows a map as a shape long before it
 * shows its name, and a suggestion filed under the wrong map is exactly what a
 * moderator has to catch by hand. The thumbnail is the same mirror image the
 * maps section uses, so nothing new is fetched for it.
 *
 * Rendered inside the trigger too, since the primitive clones the selected
 * item's content, which is why it stays small enough for a 36px row.
 */
function MapOption({ map }: { map: MapSummary }) {
  return (
    <span className="flex items-center gap-2">
      {/* The maps section's own thumbnail, with its two-step fallback: six of
          the sixty-odd arenas (the winter re-skins and the event maps) have no
          HD minimap on the mirror, and it drops to the client's low-res icon,
          then to a placeholder, so no row ever shows a broken image. */}
      <span className="relative size-8 shrink-0 overflow-hidden rounded-sm bg-fd-muted">
        <MinimapImage
          src={map.minimapUrl}
          arenaId={map.arenaId}
          alt=""
          sizes="32px"
        />
      </span>
      {map.name}
    </span>
  );
}
