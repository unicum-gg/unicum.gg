"use client";

import type { ReserveOption } from "@/hooks/use-boost-console";
import { clockTime } from "@/components/clans/detail/boost-time";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Default a freshly-checked reserve to the level you hold the most of (ties →
// the higher level), so you spend the deepest stock first.
const defaultLevel = (levels: { level: number; amount: number }[]) =>
  [...levels].sort((a, b) => b.amount - a.amount || b.level - a.level)[0]
    ?.level ?? 1;

/** The reserves-to-activate grid: a checkbox + level select per reserve type. */
export function BoostReservesPicker({
  reserves,
  picked,
  tz,
  uid,
  onChange,
  disabled = false,
}: {
  reserves: ReserveOption[];
  picked: Record<string, number>;
  tz: string;
  uid: string;
  onChange: (picked: Record<string, number>) => void;
  // Read-only preview (logged-out / non-officer): the controls render exactly as
  // they would, just non-interactive.
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs text-fd-muted-foreground">
        Reserves to activate
      </Label>
      {reserves.length === 0 && (
        <p className="text-sm text-fd-muted-foreground">
          No reserves in stock right now.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {reserves.map((r) => {
          const checked = r.type in picked;
          const levels = r.levels.filter((l) => l.amount > 0);
          const selected = r.levels.find((l) => l.level === picked[r.type]);
          const boxId = `${uid}-${r.type}`;
          return (
            <div
              key={r.type}
              className={
                checked
                  ? "flex items-center gap-3 rounded-lg border border-brand/60 bg-brand/5 p-3"
                  : "flex items-center gap-3 rounded-lg border border-fd-border p-3"
              }
            >
              <Checkbox
                id={boxId}
                checked={checked}
                disabled={disabled}
                className="data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-white"
                onCheckedChange={(v) => {
                  const next = { ...picked };
                  if (v) {
                    next[r.type] = defaultLevel(levels);
                  } else {
                    delete next[r.type];
                  }
                  onChange(next);
                }}
              />
              <Label
                htmlFor={boxId}
                className="min-w-0 flex-1 cursor-pointer items-center gap-2.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.icon}
                  alt=""
                  className="size-9 shrink-0"
                  loading="lazy"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-fd-foreground">
                    {r.name}
                  </span>
                  <span className="truncate text-xs font-normal text-fd-muted-foreground">
                    {checked && selected?.percent != null
                      ? `+${selected.percent}% ${r.bonusType}`
                      : r.bonusType}
                  </span>
                  {r.activeUntil && (
                    <span className="text-xs font-medium text-brand">
                      Active until {clockTime(r.activeUntil, tz)}
                    </span>
                  )}
                </span>
              </Label>
              {checked && levels.length > 0 && (
                <Select
                  value={String(picked[r.type])}
                  disabled={disabled}
                  onValueChange={(v) =>
                    onChange({ ...picked, [r.type]: Number(v) })
                  }
                >
                  <SelectTrigger size="sm" className="w-auto text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l.level} value={String(l.level)}>
                        Lvl {l.level}
                        {l.percent != null ? ` · +${l.percent}%` : ""} ·{" "}
                        {l.amount} left
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
