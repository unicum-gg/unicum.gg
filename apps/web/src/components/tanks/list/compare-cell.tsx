"use client";

import { ScalesIcon } from "@phosphor-icons/react";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableHead } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TankSelection } from "@/hooks/use-compare-selection";

/**
 * The comparison checkbox column, shared by every list table so picking three
 * vehicles works the same whether you are reading their damage per minute or
 * their mark thresholds.
 *
 * Both halves render nothing without a selection, so a table that isn't offering
 * the column stays exactly as it was: one line in the header, one in the row.
 */
export function TankCompareHead({
  selection,
}: {
  selection?: TankSelection;
}) {
  if (!selection) return null;
  return (
    // Both halves force the same inline start padding the list tables give
    // their first column, so the icon sits over the checkboxes rather than
    // against the table edge. `text-center!` is what beats the table's own
    // `[&_th]:text-left`.
    <TableHead className="w-10 min-w-10 ps-4! text-center!">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <ScalesIcon
              className="size-3.5 text-fd-muted-foreground"
              weight="bold"
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Pick up to {selection.max} vehicles to compare
        </TooltipContent>
      </Tooltip>
    </TableHead>
  );
}

export function TankCompareCell({
  selection,
  slug,
  name,
}: {
  selection?: TankSelection;
  slug: string;
  name: string;
}) {
  if (!selection) return null;
  const checked = selection.has(slug);
  return (
    <TableCell className="ps-4! text-center">
      <Checkbox
        checked={checked}
        // A full selection greys out what it can't take, rather than letting a
        // click do nothing.
        disabled={!checked && !selection.canAdd}
        onCheckedChange={() => selection.toggle(slug)}
        aria-label={checked ? `Remove ${name} from comparison` : `Compare ${name}`}
      />
    </TableCell>
  );
}
