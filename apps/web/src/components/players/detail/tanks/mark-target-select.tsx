"use client";

import { useSyncExternalStore } from "react";
import { useTranslation } from "@/hooks/use-translation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_MARK_TARGET,
  MARK_TARGETS,
  MarkTarget,
  readMarkTarget,
  subscribeToMarkTarget,
  writeMarkTarget,
} from "./mark-target";

/** Nothing is in the URL during server rendering, and the param is read from
 * `window` on purpose (see `useTankFilters`), so the server snapshot is the
 * absence. */
const nullSnapshot = () => null;

/**
 * The mark the table measures against, and whether the reader asked for one.
 *
 * `pinned` is what the column visibility hangs on: a reader who arrived on a
 * link from the marks panel asked for this column by asking for a target, and
 * showing them a table without it would answer their link with the view they
 * were trying to leave.
 */
export function useMarkTarget(): {
  target: MarkTarget;
  pinned: boolean;
  setTarget: (value: MarkTarget) => void;
} {
  const named = useSyncExternalStore(
    subscribeToMarkTarget,
    readMarkTarget,
    nullSnapshot,
  );
  return {
    target: named ?? DEFAULT_MARK_TARGET,
    pinned: named != null,
    setTarget: (value) => writeMarkTarget(value),
  };
}

/**
 * Which bar the mark column divides by, beside the column picker.
 *
 * A control over a reading rather than a filter, so it sits with the column
 * picker rather than among the chips: the chips all answer "which rows", and
 * this one answers "against what".
 */
export function MarkTargetSelect() {
  const { t } = useTranslation(
    "components/players/detail/tanks/mark-target-select",
  );
  const { target, setTarget } = useMarkTarget();
  const label: Record<MarkTarget, string> = {
    [MarkTarget.Next]: t("next"),
    [MarkTarget.One]: t("one"),
    [MarkTarget.Two]: t("two"),
    [MarkTarget.Three]: t("three"),
  };

  return (
    <Select
      value={target}
      onValueChange={(v) => {
        const picked = MARK_TARGETS.find((m) => m === v);
        if (picked) setTarget(picked);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("measure-against")}
        className="h-7! gap-1.5 rounded-md border-fd-border px-3! text-xs [&_svg]:size-3.5"
      >
        <SelectValue>{label[target]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {MARK_TARGETS.map((m) => (
          <SelectItem key={m} value={m} className="text-xs">
            {label[m]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
