"use client";

import { RotateCcwIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The small "reset" affordance shown in a configurator section's header: it
 * returns that section to its default state. Render it only when the section is
 * modified (the caller gates on its own dirty flag) so untouched panels stay
 * uncluttered.
 */
export function ResetButton({
  onReset,
  label = "Reset",
  className,
}: {
  onReset: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onReset}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground",
        className,
      )}
    >
      <RotateCcwIcon className="size-3.5" />
      {label}
    </button>
  );
}
