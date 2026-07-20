"use client";

import Image from "next/image";
import { CheckIcon } from "lucide-react";
import type { LoadoutDirective } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
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

// The characteristic a directive attribute reads as, for the hover tooltip. The
// spec application itself lives in @unicum.gg/shared; this only labels it.
const DIRECTIVE_LABEL: Record<string, string> = {
  "gun/reloadTime": "Reload",
  "gun/aimingTime": "Aim time",
  circularVisionRadius: "View range",
  additiveShotDispersionFactor: "Dispersion on the move",
  multShotDispersionFactor: "Accuracy",
  "engine/power": "Engine power",
};

/** A directive's effect as a signed percentage (a `mul` factor) or flat term. */
function fmtEffect(d: LoadoutDirective): string {
  if (d.type === "mul") {
    const pct = Math.round((d.value - 1) * 1000) / 10;
    return `${pct > 0 ? "+" : ""}${pct}%`;
  }
  return `${d.value > 0 ? "+" : ""}${d.value}`;
}

function DirectiveTooltip({
  directive,
  mounted,
}: {
  directive: LoadoutDirective;
  mounted: boolean;
}) {
  if (directive.crew) {
    const boost =
      directive.boostKind === "level"
        ? `×${directive.boostValue} skill level`
        : `×${directive.boostValue} efficiency`;
    return (
      <div className="w-52 space-y-2 text-xs">
        <div className="font-medium">{directive.name} directive</div>
        {directive.description ? (
          <div className="text-background/60">{directive.description}</div>
        ) : null}
        <div className="flex justify-between gap-3">
          <span className="text-background/60">Boosts {directive.name}</span>
          <span className="tabular-nums">{boost}</span>
        </div>
        <div className="border-t border-background/20 pt-1.5 text-background/60">
          {directive.effects.length > 0 || directive.camouflage
            ? "Grants and boosts the crew skill, even when untrained."
            : "Grants the crew skill for the battle (no listed characteristic)."}
        </div>
      </div>
    );
  }
  const label = DIRECTIVE_LABEL[directive.attribute] ?? directive.attribute;
  return (
    <div className="w-52 space-y-2 text-xs">
      <div className="font-medium">{directive.name} directive</div>
      {directive.description ? (
        <div className="text-background/60">{directive.description}</div>
      ) : null}
      <div className="flex justify-between gap-3 tabular-nums">
        <span className="text-background/60">{label}</span>
        <span>{fmtEffect(directive)}</span>
      </div>
      <div className="border-t border-background/20 pt-1.5 text-background/60">
        {mounted
          ? `Enhances the mounted ${directive.name}.`
          : `Mount ${directive.name} to use this directive.`}
      </div>
    </div>
  );
}

/**
 * The tank's directives (Equipment 2.0 battle boosters): each enhances one
 * mounted device and applies its bonus to the characteristics on top of the
 * equipment. A directive is only selectable once its device is mounted, and
 * toggling it re-renders the specs (the parent owns the applied set).
 */
export function TankDirectives({
  directives,
  mountedIcons,
  active,
  onToggle,
  screenLines = true,
  headerBorder = false,
}: {
  directives: LoadoutDirective[];
  /** Equipment families (icons) currently mounted; a directive needs its family. */
  mountedIcons: Set<string>;
  /** The directive keys currently applied. */
  active: Set<string>;
  onToggle: (key: string) => void;
  /** The decorative full-width edge lines. Disable when this panel sits beside
   * another (the neighbour's lines already span the row, so drawing them here
   * too would darken/double them). */
  screenLines?: boolean;
  /** A local under-title line (column-width) instead of the full-width one: use
   * when stacked below another panel, where no full-width line reaches here. */
  headerBorder?: boolean;
}) {
  if (directives.length === 0) return null;
  return (
    <TooltipProvider delayDuration={100}>
      <Panel screenLines={screenLines}>
        <PanelHeader
          screenLines={screenLines}
          className={headerBorder ? "border-b border-fd-border" : undefined}
        >
          <PanelTitle>Directives</PanelTitle>
        </PanelHeader>
        <PanelContent className="px-4 py-6">
          <div className="flex flex-wrap gap-3">
            {directives.map((d) => {
              // Crew directives are always mountable; equipment ones need their
              // device family mounted.
              const mounted = d.crew || mountedIcons.has(d.equipmentIcon);
              const on = active.has(d.key);
              return (
                <Tooltip key={d.key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={!mounted}
                      onClick={() => onToggle(d.key)}
                      aria-label={`${d.name} directive`}
                      aria-pressed={on}
                      className={cn(
                        "cursor-pointer disabled:cursor-not-allowed",
                        !mounted && "opacity-40",
                      )}
                    >
                      <span
                        className={cn(
                          "relative flex size-14 items-center justify-center rounded-lg border-2",
                          on
                            ? "border-[#f25322]/60 bg-[#f25322]/10"
                            : "border-fd-border",
                        )}
                      >
                        {d.image ? (
                          <Image
                            src={d.image}
                            alt=""
                            width={30}
                            height={30}
                            className="object-contain"
                            style={{ width: 30, height: 30 }}
                          />
                        ) : null}
                        {on ? (
                          <span className="absolute -right-1.5 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-[#f25322] ring-2 ring-fd-background">
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
                    <DirectiveTooltip directive={d} mounted={mounted} />
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
