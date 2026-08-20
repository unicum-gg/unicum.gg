"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CopySimpleIcon,
  PushPinIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "@phosphor-icons/react";
import { toRoman } from "roman-numerals";
import type { Region } from "@unicum.gg/wargaming";
import type { CompareVehicle } from "@unicum.gg/core/wargaming/wot/tanks/compare-assemble";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NationFlag } from "@/components/tanks/nation-flag";
import { MAX_SCORE } from "@/components/tanks/compare/score";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import {
  LoadoutLayout,
  TankLoadoutPanels,
} from "@/components/tanks/detail/specifications/configurator/panels";
import { TankModules } from "@/components/tanks/detail/specifications/modules";
import { TankSkillTree } from "@/components/tanks/detail/specifications/skill-tree";
import { VehicleModeToggle } from "@/components/tanks/detail/specifications/vehicle-mode";
import type { TankBuildData, TankBuild } from "@/hooks/use-tank-build";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";

/** The two configurations the game itself offers per column, and all a reader
 * needs before opening the full setup: what the vehicle ships with, and what it
 * becomes fully researched. */
function ModulePreset({ build }: { build: TankBuild }) {
  // Nothing to switch between when stock and top are the same configuration,
  // which every tier X now is (WG stopped shipping them with stock modules).
  // Note this is not `isStockModules === isTopModules`: on a configuration the
  // reader assembled in the module tree both are false, and the toggle has to
  // stay, since it is the way back to either preset.
  if (!build.interactive || !build.hasModuleChoice) return null;
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-fd-border text-[0.6875rem]">
      <button
        type="button"
        onClick={build.selectStockModules}
        className={cn(
          "cursor-pointer px-1.5 py-0.5 transition-colors",
          build.isStockModules
            ? "bg-fd-secondary text-fd-foreground"
            : "text-fd-muted-foreground hover:bg-fd-secondary/50",
        )}
      >
        Stock
      </button>
      <button
        type="button"
        onClick={build.selectTopModules}
        className={cn(
          "cursor-pointer border-l border-fd-border px-1.5 py-0.5 transition-colors",
          build.isTopModules
            ? "bg-fd-secondary text-fd-foreground"
            : "text-fd-muted-foreground hover:bg-fd-secondary/50",
        )}
      >
        Top
      </button>
    </div>
  );
}

/**
 * One vehicle at the head of its column: what it is, how it is set up, and the
 * two things you do to a column (make it the reference, take it out).
 *
 * The full setup opens in a dialog rather than under the column: the equipment
 * grid and the crew were laid out for a page's width, and a column is a quarter
 * of one. It is also where the game puts it.
 */
export function TankCompareColumnHeader({
  region,
  vehicle,
  data,
  build,
  score,
  isBest,
  pinned,
  onPin,
  onRemove,
  onApplyToAll,
}: {
  region: Region;
  vehicle: CompareVehicle;
  data: TankBuildData;
  build: TankBuild;
  /** The vehicle's overall standing as configured, or null when unscored. */
  score: number | null;
  /** Whether it holds the highest overall score of the comparison. */
  isBest: boolean;
  pinned: boolean;
  onPin: () => void;
  /** Absent when the comparison is down to its last two vehicles. */
  onRemove?: () => void;
  /** Put this column's setup on every other column. */
  onApplyToAll?: (setupToken: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { meta } = vehicle;

  return (
    <div className={cn("flex h-full flex-col gap-1.5 p-3", pinned && "bg-fd-secondary/20")}>
      <div className="flex items-start justify-between gap-1">
        <TankIcon
          region={region}
          tag={meta.tag}
          type={meta.type}
          className="h-6 w-auto shrink-0"
        />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onPin}
            aria-label={pinned ? `${meta.name} is the reference` : `Compare against ${meta.name}`}
            title={pinned ? "Reference column" : "Compare the others against this one"}
            className={cn(
              "inline-flex size-5 cursor-pointer items-center justify-center rounded transition-colors",
              pinned
                ? "text-brand"
                : "text-fd-muted-foreground/60 hover:bg-fd-border/50 hover:text-fd-foreground",
            )}
          >
            <PushPinIcon className="size-3.5" weight={pinned ? "fill" : "bold"} />
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${meta.name}`}
              className="inline-flex size-5 cursor-pointer items-center justify-center rounded text-fd-muted-foreground/60 transition-colors hover:bg-fd-border/50 hover:text-fd-foreground"
            >
              <XIcon className="size-3.5" weight="bold" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <Link
          href={ROUTES.TANK(region, vehicle.slug)}
          className="text-sm leading-tight font-semibold hover:underline"
        >
          {meta.name}
        </Link>
        {/* The comparison's answer to "so which one is better", marked on the
            name the way the player and clan comparisons mark their best rating. */}
        {isBest && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                aria-label="Highest overall score"
                className="inline-block size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-fd-primary"
              />
            </TooltipTrigger>
            <TooltipContent>Highest overall score of this comparison</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
        <NationFlag nation={meta.nation} region={region} className="h-3 w-auto" />
        <span>{toRoman(meta.tier)}</span>
        <VehicleTypeIcon type={meta.type} className="size-3" />
      </div>

      {score != null && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex w-fit cursor-help items-baseline gap-1.5">
              <span className="text-xs text-fd-muted-foreground">Overall</span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  isBest && "text-emerald-500",
                )}
              >
                {score}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            Where this vehicle sits across the whole catalogue, out of{" "}
            {MAX_SCORE}: the average of its four category scores, as configured
            here. A summary, not a verdict, a scout and a heavy reach the same
            number by being good at different things.
          </TooltipContent>
        </Tooltip>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
        <ModulePreset build={build} />
        <VehicleModeToggle
          modes={data.modes}
          active={build.mode.active}
          onToggle={build.mode.toggle}
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={`Configure ${meta.name}`}
              title="Ammunition, equipment, crew and progression"
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.6875rem] transition-colors",
                build.canResetAll
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-fd-border text-fd-muted-foreground hover:bg-fd-secondary/50 hover:text-fd-foreground",
              )}
            >
              <SlidersHorizontalIcon className="size-3" weight="bold" />
              Setup
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
            {/* `pr-12` keeps the header's actions clear of the dialog's own
                close button, which floats at `top-3 right-3`. */}
            <DialogHeader className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-fd-border py-3 pr-12 pl-4">
              <div>
                <DialogTitle className="text-base">
                  {meta.name} setup
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Ammunition, equipment, consumables, directives, crew and
                  progression for this column. Every change moves its
                  characteristics in the comparison behind.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-3">
                {/* Comparing vehicles that are not equipped alike compares the
                    equipment as much as the vehicles, so the same setup can be
                    put on every column at once. What a vehicle can't mount it
                    simply doesn't: the token is vehicle-agnostic, exactly as it
                    is when a build is copied from one tank page to another. */}
                {onApplyToAll && build.setupToken && (
                  <button
                    type="button"
                    onClick={() => {
                      onApplyToAll(build.setupToken as string);
                      setOpen(false);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-fd-muted-foreground hover:text-fd-foreground hover:underline"
                  >
                    <CopySimpleIcon className="size-3.5" weight="bold" />
                    Apply to every column
                  </button>
                )}
                {build.canResetAll && (
                  <button
                    type="button"
                    onClick={build.resetAll}
                    className="cursor-pointer text-xs text-fd-muted-foreground hover:text-fd-foreground hover:underline"
                  >
                    Reset all
                  </button>
                )}
              </div>
            </DialogHeader>
            <TankLoadoutPanels
              build={build}
              loadout={data.loadout}
              crew={data.crew}
              fieldMods={data.fieldMods}
              layout={LoadoutLayout.Stacked}
            />
            {data.skillTree && (
              <TankSkillTree
                screenLines={false}
                skillTree={data.skillTree}
                tankName={meta.name}
                unlocked={build.skillTree.unlocked}
                isAvailable={build.skillTree.isAvailable}
                onToggle={build.skillTree.toggleNode}
                dirty={build.skillTree.isDirty}
                onReset={build.skillTree.reset}
              />
            )}
            {/* The module tree, so a column can mount a specific gun rather than
                only the two presets. `nextTanks` is the research screen's "what
                this unlocks" rail, which belongs to the tank page, not here. */}
            {data.modules.length > 0 && (
              <TankModules
                screenLines={false}
                region={region}
                meta={meta}
                nodes={data.modules}
                nextTanks={[]}
                selectedModules={build.selectedModules}
                onSelectModule={build.interactive ? build.select : undefined}
                dirty={build.modulesDirty}
                onReset={build.resetModules}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
