"use client";

import Image from "next/image";
import { HoverPrefetchLink as Link } from "@/components/hover-prefetch-link";
import { CheckIcon } from "lucide-react";
import { toRoman } from "roman-numerals";
import type { Region } from "@unicum.gg/wargaming";
import { CurrencyIcon } from "@/components/tanks/currency-icon";
import { TankIcon } from "@/components/players/tank-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { VehicleMeta } from "@unicum.gg/shared";
import type {
  ModuleStats,
  TankModuleNode,
} from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type { ResearchPathItem } from "@unicum.gg/core/wargaming/wot/tanks/research-path";

const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// "A, B and C" (no Oxford comma), for the "mounted on" tank list.
const nameListFmt = new Intl.ListFormat("en-GB", {
  style: "long",
  type: "conjunction",
});

const SHELL_LABEL: Record<string, string> = {
  ARMOR_PIERCING: "AP",
  ARMOR_PIERCING_CR: "APCR",
  HIGH_EXPLOSIVE: "HE",
  HOLLOW_CHARGE: "HEAT",
};

const n1 = (v: number) => v.toFixed(1);
const n0 = (v: number) => Math.round(v).toString();

/** One "label: value" line in the module hover. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 tabular-nums">
      <span className="text-background/60">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** The module's reference stats, laid out by class. */
function ModuleStatsBlock({ stats }: { stats: ModuleStats }) {
  switch (stats.kind) {
    case "gun":
      return (
        <div className="space-y-0.5">
          <Stat label="Reload" value={`${n1(stats.reloadTime)} s`} />
          <Stat label="Aim time" value={`${n1(stats.aimTime)} s`} />
          <Stat label="Dispersion" value={`${stats.dispersion.toFixed(2)} m`} />
          <Stat
            label="Gun arc"
            value={`-${n0(stats.moveDownArc)}° / +${n0(stats.moveUpArc)}°`}
          />
          <Stat label="Ammo" value={n0(stats.maxAmmo)} />
          {stats.shells.length > 0 && (
            <div className="mt-1 space-y-0.5 border-t border-background/20 pt-1">
              {stats.shells.map((s, i) => (
                <Stat
                  key={i}
                  label={SHELL_LABEL[s.type] ?? s.type}
                  value={`${n0(s.damage)} dmg · ${n0(s.penetration)} mm`}
                />
              ))}
            </div>
          )}
        </div>
      );
    case "turret":
      return (
        <div className="space-y-0.5">
          <Stat
            label="Armor"
            value={`${n0(stats.armorFront)} / ${n0(stats.armorSides)} / ${n0(stats.armorRear)}`}
          />
          <Stat label="View range" value={`${n0(stats.viewRange)} m`} />
          <Stat label="Hit points" value={n0(stats.hp)} />
          <Stat label="Traverse" value={`${n0(stats.traverseSpeed)}°/s`} />
        </div>
      );
    case "engine":
      return (
        <div className="space-y-0.5">
          <Stat label="Power" value={`${n0(stats.power)} hp`} />
          <Stat label="Fire chance" value={`${n0(stats.fireChance * 100)}%`} />
        </div>
      );
    case "chassis":
      return (
        <div className="space-y-0.5">
          <Stat label="Load limit" value={`${n1(stats.loadLimit)} t`} />
          <Stat label="Traverse" value={`${n0(stats.traverseSpeed)}°/s`} />
        </div>
      );
    case "radio":
      return <Stat label="Signal range" value={`${n0(stats.signalRange)} m`} />;
  }
}

/** Everything about a module, shown on hover: reference stats + every vehicle
 * that can mount it. */
function ModuleTooltip({ module }: { module: TankModuleNode }) {
  const mountedList = nameListFmt.format(module.tanks.map((t) => t.name));
  return (
    <div className="w-56 space-y-2 text-xs">
      <div className="font-medium">
        {module.name}
        {module.tier ? (
          <span className="text-background/60">
            {" "}
            · Tier {toRoman(module.tier)}
          </span>
        ) : null}
      </div>
      {module.stats && <ModuleStatsBlock stats={module.stats} />}
      {module.tanks.length > 0 && (
        <div className="border-t border-background/20 pt-1.5">
          <span className="text-background/60">Mounted on </span>
          <span className="text-background/90">{mountedList}</span>
        </div>
      )}
    </div>
  );
}

export function ModuleNode({
  module,
  selected = false,
  onSelect,
}: {
  module: TankModuleNode;
  /** Highlight as the module mounted in the active configuration. */
  selected?: boolean;
  /** When set, the node is a button that switches to this module. */
  onSelect?: () => void;
}) {
  const selectable = !!onSelect;
  const body = (
    <div
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={cn(
        "flex w-24 shrink-0 flex-col items-center gap-1.5 rounded-md p-1",
        selectable ? "cursor-pointer" : "cursor-help",
      )}
    >
      <div className="flex h-7 w-full items-center justify-center">
              {module.image ? (
                // WG's per-class Tankopedia glyph (uniform 59x59 on
                // api.worldoftanks.*/static, an allowed remote host), through
                // next/image for format negotiation + caching. Rendered at h-7.
                // A check badge marks the module mounted in the active config.
                <span className="relative inline-flex">
                  <Image
                    src={module.image}
                    alt=""
                    width={59}
                    height={59}
                    className={cn(
                      "h-7 w-auto object-contain transition-opacity",
                      selected ? "opacity-100" : "opacity-80",
                    )}
                  />
                  {selected ? (
                    <span className="absolute -right-1.5 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-[#f25322] ring-2 ring-fd-background">
                      <CheckIcon className="size-2.5 text-white" strokeWidth={3} />
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col items-center gap-1 text-center leading-none">
              {module.tier ? (
                <span className="text-[11px] font-bold text-fd-muted-foreground">
                  {toRoman(module.tier)}
                </span>
              ) : null}
              <span className="max-w-24 truncate text-xs text-fd-foreground/85">
                {module.name}
              </span>
              {module.isDefault ? (
                <span className="text-[10px] leading-none text-fd-muted-foreground">
                  Stock
                </span>
              ) : (
                <div className="flex items-center gap-2 text-[10px] leading-none text-fd-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <CurrencyIcon type="xp" className="size-2.5" />
                    {compactFmt.format(module.priceXp)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <CurrencyIcon type="credits" className="h-2.5 w-auto" />
                    {compactFmt.format(module.priceCredit)}
                  </span>
                </div>
              )}
            </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{body}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-none">
          <ModuleTooltip module={module} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// The tank whose modules these are, highlighted like the tech-tree branch's
// current node.
export function CurrentTankNode({
  region,
  meta,
}: {
  region: Region;
  meta: VehicleMeta;
}) {
  return (
    <div className="flex w-24 shrink-0 flex-col items-center gap-1.5">
      <div className="relative flex h-7 w-full items-center justify-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(242,83,34,0.22),transparent_70%)]" />
        <TankIcon
          region={region}
          tag={meta.tag}
          type={meta.type}
          className="relative h-4 w-auto object-contain"
        />
      </div>
      <div className="flex flex-col items-center gap-1 text-center leading-none">
        <span className="text-[11px] font-bold text-[#f25322]">
          {meta.tier ? toRoman(meta.tier) : String(meta.tier)}
        </span>
        <span
          className="max-w-24 truncate text-xs font-semibold text-[#f25322]"
          title={meta.name}
        >
          {meta.shortName || meta.name}
        </span>
      </div>
    </div>
  );
}

// A vehicle the module tree researches, styled like the tech-tree nodes.
export function NextTankNode({
  region,
  item,
}: {
  region: Region;
  item: ResearchPathItem;
}) {
  const { meta } = item;
  return (
    <Link href={ROUTES.TANK(region, item.slug)} className="group">
      <div className="flex w-24 shrink-0 flex-col items-center gap-1.5">
        <div className="flex h-7 w-full items-center justify-center">
          <TankIcon
            region={region}
            tag={meta.tag}
            type={meta.type}
            className="h-4 w-auto object-contain opacity-80 transition-transform duration-200 group-hover:scale-110 group-hover:opacity-100"
          />
        </div>
        <div className="flex flex-col items-center gap-1 text-center leading-none">
          <span className="text-[11px] font-bold text-fd-muted-foreground">
            {meta.tier ? toRoman(meta.tier) : String(meta.tier)}
          </span>
          <span
            className="max-w-24 truncate text-xs text-fd-foreground/85"
            title={meta.name}
          >
            {meta.shortName || meta.name}
          </span>
          {item.researchXp ? (
            <span className="flex items-center gap-0.5 text-[10px] leading-none text-fd-muted-foreground">
              <CurrencyIcon type="xp" className="size-2.5" />
              {compactFmt.format(item.researchXp)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
