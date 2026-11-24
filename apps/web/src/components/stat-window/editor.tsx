"use client";

import { useState } from "react";
import { PencilSimpleIcon } from "@phosphor-icons/react";
import {
  STAT_WINDOW_MAX,
  StatWindowUnit,
  isValidStatWindow,
  sameStatWindow,
  type StatWindow,
} from "@unicum.gg/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SegmentedControl } from "@/components/segmented-control";
import { useTranslation } from "@/hooks/use-translation";

const NAMESPACE = "components/stat-window/editor";

/**
 * The pencil beside a period column's heading, opening the form that sets
 * what the column reads back over: N days, or (for a player) their last N
 * battles.
 * The draft lives here until Save, so typing never fetches a column per key.
 */
export function StatWindowEditor({
  window,
  fallback,
  label,
  units,
  onSave,
}: {
  window: StatWindow;
  /** The slot's own default, offered back as a reset. */
  fallback: StatWindow;
  /** The column's heading, for the trigger's accessible name. */
  label: string;
  /** The units this column may be set in; the switch is drawn only when
   * there is more than one to choose from. */
  units: StatWindowUnit[];
  onSave: (next: StatWindow) => void;
}) {
  const { t } = useTranslation(NAMESPACE);
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState(window.unit);
  const [value, setValue] = useState(String(window.value));

  const draft = { unit, value: Number(value) };
  const valid = value !== "" && isValidStatWindow(draft);

  function onOpenChange(next: boolean) {
    // Opened on what the column shows now, not on an abandoned draft.
    if (next) {
      setUnit(window.unit);
      setValue(String(window.value));
    }
    setOpen(next);
  }

  function save(next: StatWindow) {
    onSave(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("edit", { column: label })}
          className="rounded p-0.5 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground"
        >
          <PencilSimpleIcon className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save(draft);
          }}
        >
          {units.length > 1 ? (
            <SegmentedControl
              segments={units.map((u) => ({ id: u, label: t(`units.${u}`) }))}
              active={unit}
              onSelect={setUnit}
              className="w-full [&>*]:flex-1"
            />
          ) : null}
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={STAT_WINDOW_MAX[unit]}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={t(`units.${unit}`)}
            aria-invalid={value !== "" && !valid}
            autoFocus
          />
          <p className="text-xs text-fd-muted-foreground">
            {t("range", { max: STAT_WINDOW_MAX[unit] })}
          </p>
          <div className="flex gap-2">
            {sameStatWindow(window, fallback) ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => save(fallback)}
              >
                {t("reset")}
              </Button>
            )}
            <Button type="submit" size="sm" className="ms-auto" disabled={!valid}>
              {t("save")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
