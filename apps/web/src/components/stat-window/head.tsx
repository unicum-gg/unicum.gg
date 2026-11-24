"use client";

import { DEFAULT_STAT_WINDOWS } from "@unicum.gg/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFormat } from "@/hooks/use-format";
import { StatWindowScope, statWindowUnits, useStatWindows } from "@/hooks/use-stat-windows";
import { useTranslation } from "@/hooks/use-translation";
import { StatWindowEditor } from "./editor";
import { useStatWindowLabel } from "./label";

/**
 * The heading of one of a table's three period columns: the window's name,
 * the pencil that changes it, and (on hovering the name) where the window
 * really starts when it reaches further back than our history. Shared by every
 * table whose columns the reader sets: the profile's (Random and the mode
 * tabs read the same three windows) and the clan's.
 */
export function StatWindowHead({
  scope = StatWindowScope.Player,
  slot,
  truncated = false,
  from = null,
  editable = true,
}: {
  scope?: StatWindowScope;
  slot: 0 | 1 | 2;
  truncated?: boolean;
  from?: Date | null;
  /** The loading shell names the column without offering to change it. */
  editable?: boolean;
}) {
  const { t } = useTranslation("components/stat-window/head");
  const { date } = useFormat();
  const windowLabel = useStatWindowLabel();
  const [windows, setWindow] = useStatWindows(scope);
  const label = windowLabel(windows[slot]);
  // One line, always, and nothing wider than the name: a heading that grows a
  // second line pushes its row taller than the others, and these columns are
  // narrow (a fifth of the table on a laptop). So the date the window really
  // starts from rides on the name itself, as a tooltip with no mark of its
  // own, and a name too long for its column is cut short rather than the
  // pencil.
  const since = truncated && from ? t("since", { date: date("PP").format(from) }) : null;
  return (
    <span className="flex min-w-0 items-center gap-1 whitespace-nowrap">
      {since ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="min-w-0 cursor-help truncate"
              >
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 whitespace-normal">{since}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <span className="min-w-0 truncate" title={label}>
          {label}
        </span>
      )}
      {editable ? (
        <span className="shrink-0">
          <StatWindowEditor
            window={windows[slot]}
            fallback={DEFAULT_STAT_WINDOWS[slot]}
            label={label}
            units={statWindowUnits(scope)}
            onSave={(next) => setWindow(slot, next)}
          />
        </span>
      ) : null}
    </span>
  );
}
