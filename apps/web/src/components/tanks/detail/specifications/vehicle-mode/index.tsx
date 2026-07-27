"use client";

import type { ReactNode } from "react";
import {
  CrosshairSimpleIcon,
  GaugeIcon,
  SteeringWheelIcon,
} from "@phosphor-icons/react";
import { VehicleModeKind, type VehicleMode } from "@unicum.gg/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  effectLabel,
  fmtEffect,
} from "@/components/tanks/detail/specifications/field-mods";

const MODE_LABEL: Record<VehicleModeKind, string> = {
  [VehicleModeKind.Siege]: "Siege",
  [VehicleModeKind.Rapid]: "Rapid",
};

// WG ships no standalone icon for the drive modes, so these are Phosphor stand-ins:
// a crosshair for the siege deploy (plant + aim), a gauge for the wheeled rapid
// switch (top speed), and a steering wheel for the default travel state.
const MODE_ICON: Record<VehicleModeKind, ReactNode> = {
  [VehicleModeKind.Siege]: <CrosshairSimpleIcon className="size-3.5" weight="bold" />,
  [VehicleModeKind.Rapid]: <GaugeIcon className="size-3.5" weight="bold" />,
};
const TRAVEL_ICON = <SteeringWheelIcon className="size-3.5" weight="bold" />;

// The switch-time and gun-arc rows are shown alongside the ratio factors so the
// tooltip is a complete picture of what engaging the mode does, not just the
// characteristics that also have a table row.
function ModeTooltip({ mode }: { mode: VehicleMode }) {
  return (
    <div className="w-56 space-y-2 text-xs">
      <div className="font-medium">{MODE_LABEL[mode.kind]} mode</div>
      <div className="space-y-0.5 border-t border-background/20 pt-1.5 tabular-nums">
        {mode.factors.map((e, i) => (
          <div key={i} className="flex justify-between gap-3">
            <span className="text-background/60">{effectLabel(e.attribute)}</span>
            <span>{fmtEffect(e.type, e.value, e.attribute)}</span>
          </div>
        ))}
        {mode.depression !== null ? (
          <div className="flex justify-between gap-3">
            <span className="text-background/60">Gun depression</span>
            <span>{mode.depression}&deg;</span>
          </div>
        ) : null}
        {mode.elevation !== null ? (
          <div className="flex justify-between gap-3">
            <span className="text-background/60">Gun elevation</span>
            <span>{mode.elevation}&deg;</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <span className="text-background/60">Switch on / off</span>
          <span>
            {mode.switchOnTime}s / {mode.switchOffTime}s
          </span>
        </div>
      </div>
    </div>
  );
}

function Segment({
  label,
  icon,
  active,
  onClick,
  tooltip,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
  tooltip?: React.ReactNode;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-[#f25322]/10 text-[#f25322] ring-1 ring-[#f25322]/60"
          : "text-fd-muted-foreground hover:bg-fd-secondary/30",
      )}
    >
      {icon}
      {label}
    </button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-none">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The vehicle's alternate driving mode (siege deploy for Swedish TDs, rapid
 * switch for wheeled vehicles) as a compact segmented toggle, sat next to the
 * characteristics title: Travel is the base state, engaging a mode swaps the
 * handling/mobility characteristics on top of the current build. Renders nothing
 * for the vast majority of vehicles, which have no mode.
 */
export function VehicleModeToggle({
  modes,
  active,
  onToggle,
}: {
  modes: VehicleMode[];
  active: VehicleModeKind | null;
  onToggle: (kind: VehicleModeKind) => void;
}) {
  if (modes.length === 0) return null;
  return (
    <TooltipProvider delayDuration={100}>
      <div className="inline-flex items-center gap-1 rounded-lg border border-fd-border p-0.5">
        <Segment
          label="Travel"
          icon={TRAVEL_ICON}
          active={active === null}
          // Clicking Travel disengages whichever mode is active.
          onClick={() => active !== null && onToggle(active)}
        />
        {modes.map((mode) => (
          <Segment
            key={mode.kind}
            label={MODE_LABEL[mode.kind]}
            icon={MODE_ICON[mode.kind]}
            active={active === mode.kind}
            onClick={() => onToggle(mode.kind)}
            tooltip={<ModeTooltip mode={mode} />}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
