"use client";

import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import { TableCell } from "@/components/ui/table";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

/** Fame Points gained over the last day, or a dash for a row we cannot measure. */
export function GainCell({ value }: { value: number | null }) {
  const { num } = useFormat();
  return (
    <TableCell className="text-right tabular-nums text-muted-foreground">
      {value == null ? "—" : `+${num(INT_FORMAT).format(value)}`}
    </TableCell>
  );
}

/**
 * Places climbed or lost over the last day, as an arrow and a count, or "new"
 * for a row that held no place a day ago.
 */
export function MoveCell({ value, measured }: { value: number | null; measured: boolean }) {
  const { t } = useTranslation("components/maneuvers/columns");
  const { num } = useFormat();
  if (value == null) {
    return (
      <TableCell className="text-right text-xs text-muted-foreground">
        {measured ? t("new") : "—"}
      </TableCell>
    );
  }
  const Icon = value > 0 ? CaretUpIcon : CaretDownIcon;
  return (
    <TableCell
      className={cn(
        "text-right tabular-nums",
        value > 0 && "text-emerald-500",
        value < 0 && "text-red-500",
        value === 0 && "text-muted-foreground",
      )}
    >
      {value === 0 ? (
        "="
      ) : (
        <span className="inline-flex items-center justify-end gap-0.5">
          <Icon weight="fill" className="size-3" aria-hidden />
          {num(INT_FORMAT).format(Math.abs(value))}
        </span>
      )}
    </TableCell>
  );
}
