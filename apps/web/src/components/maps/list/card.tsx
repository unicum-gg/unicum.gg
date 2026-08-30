"use client";

import {
  ArrowsOutCardinalIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import {
  BattleType,
  markerUrl,
  type MapSummary,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  ONSLAUGHT_VIEW,
  variantViewKey,
} from "@/components/maps/detail/minimap-viewer";
import { NightCommonTestBadge } from "@/components/maps/night-badge";
import { CAMO_META } from "@/components/maps/meta";
import { MinimapImage } from "@/components/maps/minimap-image";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type BattleTab } from "@/components/maps/list/tabs";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";

// The game's base flag markers, ally green / enemy red, dropped onto the
// thumbnail so the gallery shows each map's base positions at a glance.
const BASE_ICON = { team1: markerUrl("base_ally"), team2: markerUrl("base_enemy") };

export function ThumbBases({ bases }: { bases: MapSummary["bases"] }) {
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

/** What a card shows and where it links, from the tab it is shown under. A tab
 * that names one of the map's variants opens the map on that variant's view and
 * draws its minimap, since a variant is a different space (the map's own base
 * flags go with it, they belong to the map's arena). */
export function cardView(
  tab: BattleTab,
  map: MapSummary,
): { viewParam?: string; variant?: MapSummary["variants"][number] } {
  const variant = map.variants.find((v) => v.battleType === tab);
  if (variant) {
    return { viewParam: variantViewKey(variant.battleType), variant };
  }
  if (tab === BattleType.Onslaught) return { viewParam: ONSLAUGHT_VIEW };
  return {};
}

export function MapCard({
  map,
  region,
  viewParam,
  variant,
}: {
  map: MapSummary;
  region: Region;
  /** Carries the active battle-type view onto the detail link, so a click from
   * the Onslaught tab opens the map already on its Onslaught view. */
  viewParam?: string;
  /** Draw one of the map's variant arenas instead of the map itself. */
  variant?: MapSummary["variants"][number];
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
          src={variant?.minimapUrl ?? map.minimapUrl}
          arenaId={variant?.arenaId ?? map.arenaId}
          commonTest={variant ? variant.commonTest : map.commonTest}
          alt={`${map.name} minimap`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="transition-transform duration-300 group-hover:scale-105"
        />
        {!variant && <ThumbBases bases={map.bases} />}
        {(variant ? variant.commonTest : map.commonTest) && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-fd-foreground backdrop-blur-sm">
            <NightCommonTestBadge size={12} />
            Common Test
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              aria-label={`${camo.label} map`}
              className={cn(
                "absolute right-2 top-2 rounded-full bg-black/55 p-1.5 backdrop-blur-sm",
                camo.className,
              )}
            >
              <CamoIcon weight="fill" className="size-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{camo.label} map</TooltipContent>
        </Tooltip>
        {map.hasRandomEvents && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                aria-label="Random events might change this map mid-battle"
                className="absolute left-2 top-2 rounded-full bg-black/55 p-1.5 text-[#e8955a] backdrop-blur-sm"
              >
                <WarningIcon weight="fill" className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Random events might change this map mid-battle
            </TooltipContent>
          </Tooltip>
        )}
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
