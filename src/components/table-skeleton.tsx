import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SkeletonColumn = {
  // Tailwind width of the placeholder bar, e.g. "w-6" for an icon column or
  // "w-28" for a name column.
  width: string;
  align?: "left" | "right" | "center";
  // Renders a round avatar/emblem placeholder before the bar, matching tables
  // whose name cell leads with a `size-6` emblem (taller rows) so the skeleton
  // row height lines up with the real one.
  avatar?: boolean;
};

// A block-level bar with a fixed width honours these auto margins, so the
// placeholder sits where real cell content would (numbers right, icons centered).
const ALIGN_CLASS: Record<NonNullable<SkeletonColumn["align"]>, string> = {
  left: "mr-auto",
  right: "ml-auto",
  center: "mx-auto",
};

/**
 * Placeholder shaped like a data table, shown while a table's rows are being
 * fetched on demand. `columns` mirrors the real table's column widths and
 * alignment so the skeleton lines up with the content it stands in for. Padding
 * matches the app's compact tables (`py-1.5` cells). Purely presentational.
 */
export function TableSkeleton({
  columns,
  rows = 10,
  header = true,
  cellPaddingClass = "[&_td]:py-1.5!",
}: {
  columns: SkeletonColumn[];
  rows?: number;
  header?: boolean;
  // Full arbitrary-variant class for cell vertical padding (kept as a literal
  // so Tailwind can detect it), to match tables of a different density — e.g.
  // the emblem-row leaderboards pass "[&_td]:py-2!".
  cellPaddingClass?: string;
}) {
  const rowIndexes = Array.from({ length: rows }, (_, i) => i);
  return (
    <Table className={cn("my-0!", cellPaddingClass, "[&_th]:py-2!")}>
      {header && (
        <TableHeader>
          <TableRow>
            {columns.map((col, c) => (
              <TableHead key={c}>
                <Skeleton
                  className={cn(
                    "h-3",
                    col.width,
                    ALIGN_CLASS[col.align ?? "left"],
                  )}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {rowIndexes.map((r) => (
          <TableRow key={r}>
            {columns.map((col, c) => (
              <TableCell key={c}>
                {col.avatar ? (
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-6 shrink-0 rounded" />
                    <Skeleton className={cn("h-4", col.width)} />
                  </div>
                ) : (
                  <Skeleton
                    className={cn(
                      "h-4",
                      col.width,
                      ALIGN_CLASS[col.align ?? "left"],
                    )}
                  />
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
