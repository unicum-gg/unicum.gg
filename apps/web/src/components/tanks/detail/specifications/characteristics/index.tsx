import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { TankSpec } from "@unicum.gg/shared";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { cn } from "@/lib/utils";
import { GROUPS, type Group } from "./rows";
import { deltaColor, formatSpecValue as format, specValue } from "./format";
import { CurrencyIcon } from "@/components/tanks/currency-icon";

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
  const hidden = new Set<number>();
  group.rows.forEach((row, i) => {
    if (!row.header) return;
    const subs: number[] = [];
    for (let j = i + 1; j < group.rows.length && group.rows[j].sub; j += 1)
      subs.push(j);
    if (
      subs.length > 0 &&
      subs.every((k) => specValue(specs, group.rows[k], baseline) == null)
    ) {
      hidden.add(i);
      subs.forEach((k) => hidden.add(k));
    }
  });
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground">
        {group.title}
      </h3>
      <dl className="space-y-1.5">
        {group.rows.map((row, index) => {
          if (hidden.has(index)) return null;
          if (row.header) {
            return (
              <div
                key={index}
                className="pt-1 text-sm font-medium text-fd-foreground"
              >
                {row.label}
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
          // Signed change vs the stock baseline, shown before the value like
          // tomato.gg ("-0.97 ↓"); null when unchanged at display precision.
          let delta: number | null = null;
          if (value != null && base != null && !row.neutral) {
            const diff = Number((value - base).toFixed(row.digits ?? 0));
            if (diff !== 0) delta = diff;
          }
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
                {row.label}
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

export function TankCharacteristics({
  specs,
  tankName,
  baseline = null,
}: {
  specs: TankSpec | null;
  tankName: string;
  // The reference configuration (the tank's top config); values that differ
  // from it are coloured green/red. Omit to disable the comparison.
  baseline?: TankSpec | null;
}) {
  if (!specs) return null;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{tankName} characteristics</PanelTitle>
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
