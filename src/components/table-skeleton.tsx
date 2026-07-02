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
                <Skeleton
                  className={cn(
                    "h-4",
                    col.width,
                    ALIGN_CLASS[col.align ?? "left"],
                  )}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
