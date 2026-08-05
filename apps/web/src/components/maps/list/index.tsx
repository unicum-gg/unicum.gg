"use client";

import { ArrowsOutCardinalIcon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BATTLE_TYPE_LABEL,
  BattleType,
  MapCamouflage,
  MAP_CAMOUFLAGE_LABEL,
  MAP_GAME_MODE_LABEL,
  MapGameMode,
  markerUrl,
  lowResMinimapUrl,
  type MapSummary,
} from "@unicum.gg/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BATTLE_ALL,
  type BattleTab,
  mapsTabHref,
} from "@/components/maps/list/tabs";
import { CAMO_META } from "@/components/maps/meta";
import { MinimapImage } from "@/components/maps/minimap-image";
import { Panel, PanelHeader } from "@/components/panel";
import { Chip, ChipRow } from "@/components/tanks/tank-filter-bar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";

const CAMO_FILTERS: MapCamouflage[] = [
  MapCamouflage.Summer,
  MapCamouflage.Winter,
  MapCamouflage.Desert,
];
const MODE_FILTERS: MapGameMode[] = [
  MapGameMode.Standard,
  MapGameMode.Encounter,
  MapGameMode.Assault,
];

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

// Valid URL values per filter, so a hand-edited query string can't inject a
// bogus enum member into state.
const CAMO_VALUES = new Set<string>(Object.values(MapCamouflage));
const MODE_VALUES = new Set<string>(Object.values(MapGameMode));

function parseEnumSet<T extends string>(raw: string | null, valid: Set<string>): Set<T> {
  return new Set((raw ?? "").split(",").filter((v) => valid.has(v)) as T[]);
}

const setStr = (s: Set<string>): string => [...s].join(",");

// The game's base flag markers, ally green / enemy red, dropped onto the
// thumbnail so the gallery shows each map's base positions at a glance.
const BASE_ICON = { team1: markerUrl("base_ally"), team2: markerUrl("base_enemy") };

function ThumbBases({ bases }: { bases: MapSummary["bases"] }) {
  const flags = [
    ...bases.team1.map((p) => ({ p, src: BASE_ICON.team1 })),
    ...bases.team2.map((p) => ({ p, src: BASE_ICON.team2 })),
  ];
  return (
    <div className="pointer-events-none absolute inset-0 transition-transform duration-300 group-hover:scale-105">
      {flags.map(({ p, src }, i) => (
        <Image
          key={i}
          src={src}
          alt=""
          width={20}
          height={20}
          className="absolute -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          style={{ left: `${p.left}%`, top: `${p.top}%` }}
        />
      ))}
    </div>
  );
}

function MapCard({
  map,
  region,
  viewParam,
}: {
  map: MapSummary;
  region: Region;
  /** Carries the active battle-type view onto the detail link, so a click from
   * the Onslaught tab opens the map already on its Onslaught view. */
  viewParam?: string;
}) {
  const camo = CAMO_META[map.camouflage];
  const CamoIcon = camo.icon;
  const href = viewParam
    ? `${ROUTES.MAP(region, map.slug)}?view=${viewParam}`
    : ROUTES.MAP(region, map.slug);
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-fd-border bg-fd-card transition-colors hover:border-brand"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-fd-muted">
        <MinimapImage
          src={map.minimapUrl}
          fallbackSrc={lowResMinimapUrl(map.arenaId)}
          alt={`${map.name} minimap`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="transition-transform duration-300 group-hover:scale-105"
        />
        <ThumbBases bases={map.bases} />
        <span
          className={cn(
            "absolute right-2 top-2 rounded-full bg-black/55 p-1.5 backdrop-blur-sm",
            camo.className,
          )}
          title={`${camo.label} map`}
        >
          <CamoIcon weight="fill" className="size-3.5" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="font-heading font-semibold leading-tight text-fd-foreground group-hover:text-brand">
          {map.name}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1 text-xs text-fd-muted-foreground">
          {map.sizeMeters > 0 ? (
            <>
              <span className="flex items-center gap-1.5">
                <ArrowsOutCardinalIcon className="size-3.5 shrink-0" />
                {map.sizeMeters} × {map.sizeMeters} m
                <span className="text-fd-muted-foreground/70">
                  ({(map.sizeMeters ** 2).toLocaleString("en-US")} m²)
                </span>
              </span>
              {map.modes.length > 0 && <span className="text-fd-border">·</span>}
            </>
          ) : null}
          {map.modes.length > 0
            ? `${map.modes.length} mode${map.modes.length === 1 ? "" : "s"}`
            : map.sizeMeters === 0
              ? "Special map"
              : null}
        </div>
      </div>
    </Link>
  );
}

export function MapsGallery({
  maps,
  region,
  activeTab,
  basePath,
}: {
  maps: MapSummary[];
  region: Region;
  activeTab: BattleTab;
  basePath: string;
}) {
  // The battle type is a route segment (`activeTab`); the rest of the filters
  // live in the query (?q=&camo=&mode=) so a filtered gallery stays shareable
  // and survives a reload. They start at their defaults and seed from the query
  // string on mount; changes are written back (merged with any other params)
  // via replaceState. Read via window.location, not useSearchParams, so this
  // subtree stays statically prerenderable.
  // Each battle type is a route of its own, so the active one comes from the
  // server and changes through a real navigation. That is what keeps the
  // metadata (title, description, canonical) in step; a `pushState` would leave
  // Next unaware and freeze them on the type the page was loaded with.
  const battleType = activeTab;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [camoSel, setCamoSel] = useState<Set<MapCamouflage>>(new Set());
  const [modeSel, setModeSel] = useState<Set<MapGameMode>>(new Set());

  // Seed filter state from the URL once, on mount (client-side only).
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot hydration from the URL on mount, avoids an SSR mismatch */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setQuery(q);
    const camo = parseEnumSet<MapCamouflage>(params.get("camo"), CAMO_VALUES);
    if (camo.size) setCamoSel(camo);
    const mode = parseEnumSet<MapGameMode>(params.get("mode"), MODE_VALUES);
    if (mode.size) setModeSel(mode);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Skip the write-back on the first commit so the mount-time seed above (which
  // runs after) is never clobbered by a default-state URL write.
  const skipNextWriteback = useRef(true);
  useEffect(() => {
    if (skipNextWriteback.current) {
      skipNextWriteback.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const setOrDel = (key: string, val: string) => {
      if (val) params.set(key, val);
      else params.delete(key);
    };
    setOrDel("q", query.trim());
    setOrDel("camo", setStr(camoSel));
    setOrDel("mode", setStr(modeSel));
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [query, camoSel, modeSel]);

  // Only offer battle-type pills that actually have maps in this region's
  // catalogue, so a mode WG has retired (Grand Battle currently ships no map)
  // doesn't render an empty tab. Derived, so a returning mode reappears on its
  // own.
  const presentTypes = useMemo(() => {
    const seen = new Set<BattleType>();
    for (const m of maps) for (const bt of m.battleTypes) seen.add(bt);
    return [BATTLE_ALL, ...Object.values(BattleType).filter((bt) => seen.has(bt))];
  }, [maps]);

  const battleTypeCount = useMemo(
    () =>
      battleType === BATTLE_ALL
        ? maps.length
        : maps.filter((m) => m.battleTypes.includes(battleType)).length,
    [maps, battleType],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return maps.filter((m) => {
      if (battleType !== BATTLE_ALL && !m.battleTypes.includes(battleType)) {
        return false;
      }
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (camoSel.size > 0 && !camoSel.has(m.camouflage)) return false;
      if (modeSel.size > 0 && !m.modes.some((mode) => modeSel.has(mode))) {
        return false;
      }
      return true;
    });
  }, [maps, battleType, query, camoSel, modeSel]);

  // The href carries the battle type alone, so it is what crawlers follow and
  // what Next prefetches. The click adds the current search and camo/mode
  // filters (they live in the query string) so switching type keeps them, then
  // navigates for real.
  function selectBattleType(
    e: MouseEvent<HTMLAnchorElement>,
    next: BattleTab,
  ) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (next === battleType) return;
    router.push(`${mapsTabHref(basePath, next)}${window.location.search}`);
  }

  return (
    <Panel>
      <PanelHeader className="px-0! py-0!">
          <nav className="flex items-center overflow-x-auto text-sm">
            {presentTypes.map((bt) => (
              <Link
                key={bt}
                href={mapsTabHref(basePath, bt)}
                onClick={(e) => selectBattleType(e, bt)}
                className={cn(
                  "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap transition-colors",
                  battleType === bt
                    ? "bg-fd-secondary/40 text-fd-foreground"
                    : "text-fd-muted-foreground hover:bg-fd-secondary/20 hover:text-fd-foreground",
                )}
              >
                {bt === BATTLE_ALL ? "All" : BATTLE_TYPE_LABEL[bt]}
              </Link>
            ))}
          </nav>
        </PanelHeader>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 p-4 text-xs">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search among ${battleTypeCount.toLocaleString("en-US")} maps`}
          aria-label="Search maps"
          className="h-7 w-52 rounded-md border border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:border-fd-ring focus:outline-none"
        />
        <ChipRow>
          <TooltipProvider delayDuration={100}>
            {CAMO_FILTERS.map((camo) => {
              const meta = CAMO_META[camo];
              const Icon = meta.icon;
              const active = camoSel.has(camo);
              return (
                <Tooltip key={camo}>
                  <TooltipTrigger asChild>
                    <Chip
                      active={active}
                      onClick={() => setCamoSel((s) => toggle(s, camo))}
                    >
                      <Icon
                        weight="fill"
                        className={cn("size-3.5", active && meta.className)}
                      />
                    </Chip>
                  </TooltipTrigger>
                  <TooltipContent>{MAP_CAMOUFLAGE_LABEL[camo]}</TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </ChipRow>
        <ChipRow>
          {MODE_FILTERS.map((mode) => (
            <Chip
              key={mode}
              active={modeSel.has(mode)}
              onClick={() => setModeSel((s) => toggle(s, mode))}
            >
              {MAP_GAME_MODE_LABEL[mode]}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <div className="border-t border-fd-border p-4">
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-fd-muted-foreground">
            No maps match your filters.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((map) => (
              <MapCard
                key={map.arenaId}
                map={map}
                region={region}
                viewParam={
                  battleType === BattleType.Onslaught ? "onslaught" : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
