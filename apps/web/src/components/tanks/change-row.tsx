import { ArrowRightIcon } from "lucide-react";
import type { FormattedChange } from "@/components/tanks/change-format";
import { cn } from "@/lib/utils";

/** One change on its own line: label on the left, before -> after with the
 * signed delta on the right, coloured buff (green) / nerf (red) / neutral.
 * Shared by the per-tank History tab and the global changes feed so a change
 * reads the same in both. Stack these in a `divide-y` list; `className` sets the
 * horizontal padding (full-width `px-4` in the History tab, `pr-4` in the feed
 * where the left padding comes from the tank column's border). */
export function ChangeRow({
  change,
  className,
}: {
  change: FormattedChange;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-4 py-2 text-sm",
        className,
      )}
    >
      <span className="min-w-0 truncate text-fd-muted-foreground">
        {change.label}
      </span>
      <div className="flex shrink-0 items-center gap-2 tabular-nums">
        <span className="text-fd-muted-foreground">{change.before}</span>
        <ArrowRightIcon className="size-3.5 text-fd-muted-foreground/60" />
        <span className={cn("font-medium", change.color)}>{change.after}</span>
        {change.unit ? (
          <span className="text-xs text-fd-muted-foreground">{change.unit}</span>
        ) : null}
        {change.delta ? (
          <span
            className={cn(
              "ml-1 min-w-14 text-right text-xs font-medium",
              change.color,
            )}
          >
            {change.delta}
          </span>
        ) : null}
      </div>
    </li>
  );
}
