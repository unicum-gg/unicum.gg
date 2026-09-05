"use client";

import { VehicleModeKind, type VehicleMode } from "@unicum.gg/shared";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Segment,
  SegmentedControl,
} from "@/components/tanks/detail/specifications/segmented-control";
import {
  effectLabel,
  fmtEffect,
} from "@/components/tanks/detail/specifications/field-mods";
import {
  modeLabel,
  ModeIcon,
  travelLabel,
} from "@/components/tanks/detail/mode-marks";

// The switch-time and gun-arc rows are shown alongside the ratio factors so the
// tooltip is a complete picture of what engaging the mode does, not just the
// characteristics that also have a table row.
function ModeTooltip({
  mode,
  mechanic,
}: {
  mode: VehicleMode;
  mechanic: string | null;
}) {
  return (
    <div className="w-56 space-y-2 text-xs">
      <div className="font-medium">{modeLabel(mechanic, mode.kind)} mode</div>
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

/**
 * The vehicle's second state as a compact segmented toggle, sat next to the
 * characteristics title: the left segment is the state it is in before the
 * switch, engaging the other swaps the handling and mobility characteristics on
 * top of the current build. Renders nothing for the vast majority of vehicles,
 * which have no second state.
 *
 * Both segments are named for the mechanic rather than for the siege the client
 * tags all of them as, and by the same function the hero's mark uses, so the
 * two switches offering the same act say the same words.
 */
export function VehicleModeToggle({
  modes,
  active,
  mechanic = null,
  compact,
  onToggle,
}: {
  modes: VehicleMode[];
  active: VehicleModeKind | null;
  /** Which mechanic the second state is, where the caller knows it. */
  mechanic?: string | null;
  /**
   * Sized for a row of small buttons rather than for a title.
   *
   * The comparison puts one of these on every column beside the Setup button,
   * where the roomier size stood a third taller than everything around it.
   */
  compact?: boolean;
  onToggle: (kind: VehicleModeKind) => void;
}) {
  if (modes.length === 0) return null;
  const glyph = compact ? "size-3" : "size-3.5";
  return (
    <TooltipProvider delayDuration={100}>
      <SegmentedControl compact={compact}>
        <Segment
          compact={compact}
          label={travelLabel(mechanic)}
          icon={
            <ModeIcon mechanic={mechanic} engaged={false} className={glyph} />
          }
          active={active === null}
          // Clicking Travel disengages whichever mode is active.
          onClick={() => active !== null && onToggle(active)}
        />
        {modes.map((mode) => (
          <Segment
            key={mode.kind}
            compact={compact}
            label={modeLabel(mechanic, mode.kind)}
            icon={<ModeIcon mechanic={mechanic} engaged className={glyph} />}
            active={active === mode.kind}
            onClick={() => onToggle(mode.kind)}
            tooltip={<ModeTooltip mode={mode} mechanic={mechanic} />}
          />
        ))}
      </SegmentedControl>
    </TooltipProvider>
  );
}
