import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { TankSpec } from "@unicum.gg/shared";
import { GlossaryLabel } from "@/components/glossary/label";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ResetButton } from "@/components/tanks/detail/specifications/reset-button";
import { GROUPS, type Group } from "./rows";
import {
  deltaColor,
  formatSpecValue as format,
  hiddenRowIndexes,
  rowDelta,
  specValue,
} from "./format";
import { CurrencyIcon } from "@/components/tanks/currency-icon";

/** The label of the row a sub-row is indented under, walking back up the list
 * the way the display nests them. */
function parentOf(group: Group, index: number): string | undefined {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!group.rows[i].sub) return group.rows[i].label.replace(/^…\s*/, "");
  }
  return undefined;
}

function SpecGroup({
  group,
  specs,
  baseline,
}: {
  group: Group;
  specs: TankSpec;
  baseline: TankSpec | null;
}) {
  // Hide a sub-heading and its indented rows when every one of them is empty
  // (e.g. "Turret armor" on a turretless casemate would otherwise be all "—").
  // Shared with the comparison grid, which does the same over several columns.
  const hidden = hiddenRowIndexes(group, [{ specs, baseline }]);
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground">
        {group.title}
      </h3>
      <dl className="space-y-1.5">
        {group.rows.map((row, index) => {
          if (hidden.has(index)) return null;
          // What the glossary is asked about: the row's own wording, without
          // the ellipsis a sub-row is indented with, and the row it hangs off
          // when nothing defines that variant on its own. Computed after the
          // discards above, so a hidden row never pays for the parent walk.
          const ownLabel = row.label.replace(/^…\s*/, "");
          const parentLabel = row.sub ? parentOf(group, index) : undefined;
          if (row.header) {
            return (
              <div
                key={index}
                className="pt-1 text-sm font-medium text-fd-foreground"
              >
                <GlossaryLabel label={ownLabel}>{row.label}</GlossaryLabel>
              </div>
            );
          }
          const value = specValue(specs, row, baseline);
          // Conditional rows (the clip stats on a single-shot gun) drop out
          // entirely instead of showing a dash.
          if (row.hideWhenEmpty && value == null) return null;
          const base = baseline ? specValue(baseline, row, baseline) : null;
          const color =
            value != null ? deltaColor(value, base, row) : undefined;
          // Signed change vs the stock baseline, shown before the value
          // ("-0.97 ↓"); null when unchanged at display precision.
          const delta = rowDelta(value, base, row);
          return (
            <div
              key={index}
              className={cn(
                "flex items-baseline gap-2 text-sm",
                row.sub && "pl-3",
              )}
            >
              <dt
                className={cn(
                  "text-fd-muted-foreground",
                  row.sub && "text-fd-muted-foreground/75",
                )}
              >
                <GlossaryLabel
                  specKey={row.key}
                  label={ownLabel}
                  fallbackLabel={parentLabel}
                >
                  {row.label}
                </GlossaryLabel>
              </dt>
              <span
                aria-hidden
                className="mb-1 flex-1 self-end border-b border-dotted border-fd-border"
              />
              <dd className="flex items-baseline gap-1.5 whitespace-nowrap font-medium tabular-nums">
                {value != null ? (
                  <>
                    {delta != null && (
                      <span
                        className={cn("inline-flex items-center text-xs", color)}
                      >
                        {delta > 0 ? "+" : ""}
                        {format(delta, row.digits)}
                        {delta > 0 ? (
                          <ChevronUpIcon className="size-3" />
                        ) : (
                          <ChevronDownIcon className="size-3" />
                        )}
                      </span>
                    )}
                    <span>
                      {format(value, row.digits)}
                      {(() => {
                        const raw = row.secondary ? specs[row.secondary] : null;
                        return typeof raw === "number" ? (
                          <span className="text-fd-muted-foreground/70">
                            {" / "}
                            {format(raw, row.digits)}
                          </span>
                        ) : null;
                      })()}
                      {row.currency ? (
                        <CurrencyIcon
                          type={row.currency}
                          className="ml-1 inline-block h-3 w-auto translate-y-px text-fd-muted-foreground"
                        />
                      ) : row.unit ? (
                        <span className="ml-0.5 text-xs text-fd-muted-foreground">
                          {row.unit}
                        </span>
                      ) : null}
                    </span>
                  </>
                ) : (
                  <span className="text-fd-muted-foreground">—</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function TankCharacteristics(
  props:
    | { loading: true }
    | {
        specs: TankSpec | null;
        tankName: string;
        // The reference configuration (the tank's top config); values that
        // differ from it are coloured green/red. Omit to disable the comparison.
        baseline?: TankSpec | null;
        /** Whether any section is modified (shows the "Reset all" button). */
        canResetAll?: boolean;
        /** Reset every configurator section to its default at once. */
        onResetAll?: () => void;
        /** Extra header controls (e.g. "Share build"), left of Reset. */
        actions?: React.ReactNode;
        /** Inline control sat next to the title (the driving-mode toggle). */
        titleControl?: React.ReactNode;
      },
) {
  if ("loading" in props) return <CharacteristicsSkeleton />;
  const {
    specs,
    tankName,
    baseline = null,
    canResetAll = false,
    onResetAll,
    actions,
    titleControl,
  } = props;
  if (!specs) return null;
  const hasActions = actions || (canResetAll && onResetAll);
  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PanelTitle>{tankName} characteristics</PanelTitle>
          {titleControl}
        </div>
        {hasActions ? (
          <div className="flex items-center gap-3">
            {actions}
            {canResetAll && onResetAll ? (
              <ResetButton onReset={onResetAll} label="Reset all" />
            ) : null}
          </div>
        ) : null}
      </PanelHeader>
      <PanelContent className="grid grid-cols-1 gap-x-8 gap-y-6 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
        {GROUPS.map((group) => (
          <SpecGroup
            key={group.title}
            group={group}
            specs={specs}
            baseline={baseline}
          />
        ))}
      </PanelContent>
    </Panel>
  );
}

/** The loading twin: the same 4-column grid over the real GROUPS (so the group
 * titles and row counts can't drift), each row a `label ···· value` placeholder
 * on a text-sm line-box so the block lands at the loaded height. */
function CharacteristicsSkeleton() {
  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between gap-4">
        <PanelTitle>Characteristics</PanelTitle>
      </PanelHeader>
      <PanelContent className="grid grid-cols-1 gap-x-8 gap-y-6 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground">
              {group.title}
            </h3>
            <dl className="space-y-1.5">
              {group.rows.map((row, index) =>
                // Conditional rows (clip stats on single-shot guns, turret
                // armor on turretless hulls) are hidden on most tanks — skip
                // them so the skeleton lands near the common loaded height.
                row.hideWhenEmpty ? null : row.header ? (
                  <div key={index} className="flex h-5 items-center pt-1">
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                ) : (
                  <div
                    key={index}
                    className={cn(
                      "flex h-5 items-baseline gap-2",
                      row.sub && "pl-3",
                    )}
                  >
                    <Skeleton className="h-3.5 w-20" />
                    <span
                      aria-hidden
                      className="mb-1 flex-1 self-end border-b border-dotted border-fd-border"
                    />
                    <Skeleton className="h-3.5 w-10" />
                  </div>
                ),
              )}
            </dl>
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}
