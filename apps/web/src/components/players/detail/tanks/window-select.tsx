"use client";

import {
  StatWindowUnit,
  formatStatWindow,
  parseStatWindow,
  type StatWindow,
} from "@unicum.gg/shared";
import { Hint } from "@/components/hint";
import { StatWindowEditor } from "@/components/stat-window/editor";
import { useStatWindowLabel } from "@/components/stat-window/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

/** The select's value for the vehicles' careers, which no window parses to. */
const CAREER = "career";

/** The windows offered in one click. Anything else is the pencil's. */
const PRESETS: StatWindow[] = [
  { unit: StatWindowUnit.Days, value: 1 },
  { unit: StatWindowUnit.Days, value: 7 },
  { unit: StatWindowUnit.Days, value: 30 },
  { unit: StatWindowUnit.Days, value: 90 },
  { unit: StatWindowUnit.Battles, value: 100 },
  { unit: StatWindowUnit.Battles, value: 1000 },
];

/** Where the pencil opens when the table shows the careers. */
const EDITOR_START: StatWindow = { unit: StatWindowUnit.Days, value: 30 };

const UNITS = [StatWindowUnit.Days, StatWindowUnit.Battles];

/**
 * What the garage table is read over: the vehicles' careers, or a window.
 *
 * The same pair of controls as a period column of the stats table, a choice
 * and the pencil beside it, so a window is set the same way everywhere on the
 * profile. A custom window the presets do not hold joins the list while it is
 * the one shown, or the trigger would read blank over it.
 *
 * Disabled outside Random Battles, and says why: the per-mode breakdown is the
 * vehicle's current record with no history behind it, so there is nothing to
 * read a window of.
 */
export function TankWindowSelect({
  window,
  onSelect,
  disabled = false,
  className,
}: {
  window: StatWindow | null;
  onSelect: (next: StatWindow | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation("components/players/detail/tanks/window-select");
  const label = useStatWindowLabel();
  const options =
    window && !PRESETS.some((p) => formatStatWindow(p) === formatStatWindow(window))
      ? [...PRESETS, window]
      : PRESETS;

  const select = (
    <span className={cn("flex items-center gap-1", className)}>
      <Select
        value={window && !disabled ? formatStatWindow(window) : CAREER}
        onValueChange={(value) =>
          onSelect(value === CAREER ? null : parseStatWindow(value))
        }
        disabled={disabled}
      >
        <SelectTrigger
          size="sm"
          aria-label={t("label")}
          className="h-8 w-36 bg-transparent text-xs dark:bg-transparent"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CAREER}>{t("career")}</SelectItem>
          {options.map((w) => (
            <SelectItem key={formatStatWindow(w)} value={formatStatWindow(w)}>
              {label(w)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {disabled ? null : (
        <StatWindowEditor
          window={window ?? EDITOR_START}
          label={t("label")}
          units={UNITS}
          onSave={onSelect}
        />
      )}
    </span>
  );

  if (!disabled) return select;
  return (
    <TooltipProvider>
      <Hint content={t("random-only")} contentClassName="max-w-64">
        {/* A disabled trigger takes no pointer events, so the hint hangs on
            the wrapper around it. */}
        <span tabIndex={0}>{select}</span>
      </Hint>
    </TooltipProvider>
  );
}
