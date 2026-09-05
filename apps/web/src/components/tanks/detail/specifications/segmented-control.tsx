"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The small segmented toggles that sit next to the characteristics title.
 *
 * Two of them share this: the driving mode (travel / siege / rapid) and the game
 * client the characteristics are read from (live / Common Test). They are the
 * same control over different axes, so they look the same by construction rather
 * than by two copies of the same classes drifting apart.
 *
 * The caller supplies the `TooltipProvider`: a control whose segments have no
 * tooltip should not mount one.
 */
export function SegmentedControl({
  children,
  compact,
}: {
  children: ReactNode;
  /**
   * Sized to sit in a row of small buttons rather than beside a title.
   *
   * The comparison puts this next to the Setup button on every column, where
   * the roomier version stood a third taller than everything around it. The
   * padding goes rather than the grouping: the border is what says the two
   * segments are one choice, and losing it would leave two loose buttons.
   */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-fd-border",
        compact ? "gap-0.5" : "gap-1 p-0.5",
      )}
    >
      {children}
    </div>
  );
}

/** One choice of a `SegmentedControl`. */
export function Segment({
  label,
  icon,
  active,
  onClick,
  tooltip,
  disabled,
  compact,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
  tooltip?: ReactNode;
  /** Set while the segment's data is still loading, so it can't be re-entered. */
  disabled?: boolean;
  /** Matches the small buttons it shares a row with. See `SegmentedControl`. */
  compact?: boolean;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-md font-medium transition-colors",
        compact
          ? "px-1.5 py-0.5 text-[0.6875rem]"
          : "px-2.5 py-1 text-xs",
        active
          ? "bg-brand/10 text-brand ring-1 ring-brand/60"
          : "text-fd-muted-foreground hover:bg-fd-secondary/30",
        disabled && "cursor-progress opacity-60",
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
