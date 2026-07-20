"use client";

import Image from "next/image";
import { CheckIcon } from "lucide-react";
import type { ModuleShell } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import { iconUrl } from "@unicum.gg/shared";
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
import { CurrencyIcon } from "@/components/tanks/currency-icon";

// WG's own shell-type icons, from our wot.assets mirror (keyed by the raw shell
// type, which matches the file name), served through next/image.
const AMMO_ICON = iconUrl("ammopanel/ammo");

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** The current gun's shells, shown as slot-style boxes (one per shell type)
 * with the WG icon and the damage / penetration underneath. Clicking one selects
 * it, so the characteristics show that shell's damage and penetration. */
export function TankAmmo({
  shells,
  active,
  onSelect,
  dirty = false,
  onReset,
  screenLines = true,
  headerBorder = false,
}: {
  shells: (ModuleShell & {
    velocity?: number | null;
    splash?: number | null;
    pen500?: number | null;
    icon?: string | null;
    cost?: number | null;
    /** Shell names from WoT's localization; fall back to the raw kind. */
    shortName?: string | null;
    kindName?: string | null;
    name?: string | null;
  })[];
  /** Index of the selected shell. */
  active: number;
  onSelect: (index: number) => void;
  /** Whether the section deviates from its default (shows the reset button). */
  dirty?: boolean;
  /** Reset the section to its default (the first shell). */
  onReset?: () => void;
  /** The decorative full-width edge lines; disable when beside another panel. */
  screenLines?: boolean;
  /** A local under-title line (column-width), when stacked below another panel. */
  headerBorder?: boolean;
}) {
  if (shells.length === 0) return null;
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
          <PanelTitle>Ammunition</PanelTitle>
          {dirty && onReset ? <ResetButton onReset={onReset} /> : null}
        </PanelHeader>
        <PanelContent className="px-4 py-6">
          <div className="flex flex-wrap gap-3">
            {shells.map((s, i) => {
              const short = s.shortName ?? s.type;
              // Title is the shell's own name (e.g. "122 mm UOF-471"); the kind
              // (High-Explosive) is a subtitle. Fall back to the kind, then type.
              const kindName = s.kindName ?? s.type;
              const name = s.name ?? kindName;
              const selected = i === active;
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelect(i)}
                      aria-pressed={selected}
                      aria-label={`${name}: ${s.damage} damage, ${s.penetration} mm penetration`}
                      className="flex cursor-pointer flex-col items-center gap-1.5"
                    >
                      <span
                        className={cn(
                          "relative flex size-14 items-center justify-center rounded-lg border-2 transition-colors",
                          selected
                            ? "border-[#f25322]/60 bg-[#f25322]/10"
                            : "border-fd-border bg-fd-secondary/30 hover:bg-fd-secondary/50",
                        )}
                      >
                        <Image
                          src={`${AMMO_ICON}/${s.icon ?? s.type}.png`}
                          alt=""
                          width={36}
                          height={36}
                          className="object-contain"
                          style={{ width: 36, height: 36 }}
                        />
                        {selected ? (
                          <span className="absolute -right-1.5 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-[#f25322] ring-2 ring-fd-background">
                            <CheckIcon
                              className="size-2.5 text-white"
                              strokeWidth={3}
                            />
                          </span>
                        ) : null}
                      </span>
                      <span className="flex flex-col items-center gap-0.5 leading-none">
                        <span
                          className={cn(
                            "text-[11px] font-semibold",
                            selected
                              ? "text-[#f25322]"
                              : "text-fd-foreground/85",
                          )}
                        >
                          {short}
                        </span>
                        <span className="text-[10px] tabular-nums text-fd-muted-foreground">
                          {s.damage} · {s.penetration} mm
                        </span>
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="space-y-0.5 text-xs">
                      <div className="font-medium">{name}</div>
                      {s.name && kindName !== name ? (
                        <div className="text-background/50">{kindName}</div>
                      ) : null}
                      <div className="flex justify-between gap-4 tabular-nums">
                        <span className="text-background/60">Damage</span>
                        <span>{s.damage}</span>
                      </div>
                      <div className="flex justify-between gap-4 tabular-nums">
                        <span className="text-background/60">Penetration</span>
                        <span>{s.penetration} mm</span>
                      </div>
                      {typeof s.pen500 === "number" ? (
                        <div className="flex justify-between gap-4 tabular-nums">
                          <span className="text-background/60">… at 500m</span>
                          <span>{s.pen500} mm</span>
                        </div>
                      ) : null}
                      {typeof s.velocity === "number" ? (
                        <div className="flex justify-between gap-4 tabular-nums">
                          <span className="text-background/60">Velocity</span>
                          <span>{intFmt.format(s.velocity)} m/s</span>
                        </div>
                      ) : null}
                      {typeof s.splash === "number" && s.splash > 0 ? (
                        <div className="flex justify-between gap-4 tabular-nums">
                          <span className="text-background/60">Splash</span>
                          <span>{s.splash} m</span>
                        </div>
                      ) : null}
                      {typeof s.cost === "number" && s.cost > 0 ? (
                        <div className="flex justify-between gap-4 tabular-nums">
                          <span className="text-background/60">Cost</span>
                          <span className="flex items-center gap-1">
                            {intFmt.format(s.cost)}
                            <CurrencyIcon
                              type="credits"
                              className="text-background/70"
                            />
                          </span>
                        </div>
                      ) : null}
                    </div>
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
