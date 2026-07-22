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
};

// Justify the bar inside a fixed-height line-box, so the placeholder sits where
// real cell content would (numbers right, icons centered).
const JUSTIFY: Record<NonNullable<SkeletonColumn["align"]>, string> = {
  left: "justify-start",
  right: "justify-end",
  center: "justify-center",
};

/**
 * Placeholder shaped like a data table, shown while a table's rows are being
 * fetched on demand. `columns` mirrors the real table's column widths and
 * alignment so the skeleton lines up with the content it stands in for. Each
 * cell's bar sits in a fixed-height line-box (`h-6` body / `h-4` head) so the
 * rows match the app's compact icon/text tables (~24px content) instead of
 * collapsing to the bar height. Purely presentational.
 */
export function TableSkeleton({
  columns,
  rows = 10,
  header = true,
}: {
  columns: SkeletonColumn[];
  rows?: number;
  header?: boolean;
}) {
  const rowIndexes = Array.from({ length: rows }, (_, i) => i);
  return (
    <Table className="my-0! [&_td]:py-1.5! [&_th]:py-2!">
      {header && (
        <TableHeader>
          <TableRow>
            {columns.map((col, c) => (
              <TableHead key={c}>
                <div
                  className={cn(
                    "flex h-4 items-center",
                    JUSTIFY[col.align ?? "left"],
                  )}
                >
                  <Skeleton className={cn("h-3", col.width)} />
                </div>
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
                <div
                  className={cn(
                    "flex h-6 items-center",
                    JUSTIFY[col.align ?? "left"],
                  )}
                >
                  <Skeleton className={cn("h-4", col.width)} />
                </div>
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
