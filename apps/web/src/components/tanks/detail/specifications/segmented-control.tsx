"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SEGMENTED_BOX, segmentClass } from "@/components/segmented-control";

/**
 * The small segmented toggles that sit next to the characteristics title.
 *
 * Drawn with the site's one switch look (`SEGMENTED_BOX`, `segmentClass`),
 * kept as a children-based API because its segments carry tooltips and a
 * loading state the call sites build inline.
 *
 * Two of them share this: the driving mode (travel / siege / rapid) and the game
 * client the characteristics are read from (live / Common Test). They are the
 * same control over different axes, so they look the same by construction rather
 * than by two copies of the same classes drifting apart.
 *
 * The caller supplies the `TooltipProvider`: a control whose segments have no
 * tooltip should not mount one.
 */
export function SegmentedControl({ children }: { children: ReactNode }) {
  return <div className={SEGMENTED_BOX}>{children}</div>;
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
        segmentClass(active, compact),
        "cursor-pointer",
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
