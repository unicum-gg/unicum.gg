"use client";

import Image from "next/image";
import { CheckIcon, PlusIcon } from "lucide-react";
import type { LoadoutConsumable } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ResetButton } from "@/components/tanks/detail/specifications/reset-button";

const SLOTS = 3;

// The characteristic a consumable's passive effect reads as, for the tooltip.
const EFFECT_LABEL: Record<string, string> = {
  enginePowerFactor: "Engine power",
  turretRotationSpeedFactor: "Turret traverse",
  fireStartingChanceFactor: "Fire chance",
  maxSpeedFactor: "Top speed",
  crewLevelIncrease: "Crew skills",
};

/** A `mul` factor as a signed percentage; `crewLevelIncrease` is already a flat
 * percent-point bonus (+10), not a factor. */
function fmtEffect(attribute: string, value: number): string {
  if (attribute === "crewLevelIncrease") return `+${value}%`;
  const pct = Math.round((value - 1) * 1000) / 10;
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function ConsumableTooltip({ consumable }: { consumable: LoadoutConsumable }) {
  return (
    <div className="w-52 space-y-2 text-xs">
      <div className="font-medium">{consumable.name}</div>
      {consumable.description ? (
        <div className="text-background/60">{consumable.description}</div>
      ) : null}
      {consumable.effects.length > 0 ? (
        <div className="space-y-0.5 border-t border-background/20 pt-1.5">
          {consumable.effects.map((e) => (
            <div
              key={e.attribute}
              className="flex justify-between gap-3 tabular-nums"
            >
              <span className="text-background/60">
                {EFFECT_LABEL[e.attribute] ?? e.attribute}
              </span>
              <span>{fmtEffect(e.attribute, e.value)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-t border-background/20 pt-1.5 text-background/60">
          No characteristic effect.
        </div>
      )}
    </div>
  );
}

/**
 * The tank's consumables, mirroring the equipment flow: three slots on top (pick
 * one to select it), and every compatible consumable below (click one to mount
 * it in the selected slot). The parent applies the mounted ones' passive effects
 * to the characteristics.
 */
export function TankConsumables({
  consumables,
  slots,
  activeSlot,
  onSelectSlot,
  onPick,
  dirty = false,
  onReset,
  screenLines = true,
  headerBorder = false,
}: {
  consumables: LoadoutConsumable[];
  /** The mounted consumable key per slot (null = empty), one entry per slot. */
  slots: (string | null)[];
  /** Index of the selected slot; a picked consumable mounts there. */
  activeSlot: number;
  onSelectSlot: (index: number) => void;
  onPick: (key: string) => void;
  /** Whether the section deviates from its default (shows the reset button). */
  dirty?: boolean;
  /** Reset the section to its default (no consumable mounted). */
  onReset?: () => void;
  /** The decorative full-width edge lines; disable when beside another panel. */
  screenLines?: boolean;
  /** A local under-title line (column-width), when stacked below another panel. */
  headerBorder?: boolean;
}) {
  if (consumables.length === 0) return null;
  const byKey = new Map(consumables.map((c) => [c.key, c]));
  const mountedSet = new Set(slots.filter((k): k is string => !!k));
  return (
    <TooltipProvider delayDuration={100}>
      <Panel screenLines={screenLines}>
        <PanelHeader
          screenLines={screenLines}
          className={cn(
            "flex items-center justify-between gap-4",
            headerBorder && "border-b border-fd-border",
          )}
        >
          <PanelTitle>Consumables</PanelTitle>
          {dirty && onReset ? <ResetButton onReset={onReset} /> : null}
        </PanelHeader>
        <PanelContent className="space-y-5 px-4 py-6">
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: SLOTS }).map((_, i) => {
              const key = slots[i];
              const c = key ? byKey.get(key) : null;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelectSlot(i)}
                  aria-pressed={activeSlot === i}
                  aria-label={`Consumable slot ${i + 1}${c ? `: ${c.name}` : ""}`}
                  className={cn(
                    "cursor-pointer rounded-lg transition-shadow",
                    activeSlot === i
                      ? "ring-2 ring-brand ring-offset-2 ring-offset-fd-background"
                      : "",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-14 items-center justify-center rounded-lg border-2",
                      c
                        ? "border-solid border-fd-border bg-fd-secondary/30"
                        : "border-dashed border-fd-border",
                    )}
                  >
                    {c?.image ? (
                      <Image
                        src={c.image}
                        alt=""
                        width={30}
                        height={30}
                        className="object-contain"
                        style={{ width: 30, height: 30 }}
                      />
                    ) : (
                      <PlusIcon className="size-5 text-fd-muted-foreground" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="-mx-4 border-t border-fd-border" />

          <div className="flex flex-wrap gap-3">
            {consumables.map((c) => {
              const isMounted = mountedSet.has(c.key);
              return (
                <Tooltip key={c.key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onPick(c.key)}
                      aria-pressed={isMounted}
                      aria-label={c.name}
                      className="cursor-pointer"
                    >
                      <span
                        className={cn(
                          "relative flex size-14 items-center justify-center rounded-lg border-2 transition-colors",
                          isMounted
                            ? "border-brand/60 bg-brand/10"
                            : "border-fd-border hover:bg-fd-secondary/30",
                        )}
                      >
                        {c.image ? (
                          <Image
                            src={c.image}
                            alt=""
                            width={30}
                            height={30}
                            className="object-contain"
                            style={{ width: 30, height: 30 }}
                          />
                        ) : null}
                        {isMounted ? (
                          <span className="absolute -right-1.5 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-brand ring-2 ring-fd-background">
                            <CheckIcon
                              className="size-2.5 text-white"
                              strokeWidth={3}
                            />
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-none">
                    <ConsumableTooltip consumable={c} />
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </PanelContent>
      </Panel>
    </TooltipProvider>
  );
}
