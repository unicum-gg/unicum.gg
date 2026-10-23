import { cn } from "@/lib/utils";

/**
 * One line: a label, a value, and whether it breaks down the line above it.
 *
 * `free` is the second column the game's Experience block carries, the free
 * experience behind the same line. Empty where a line has none of its own.
 */
export type Row = {
  label: string;
  value: string;
  free?: string;
  under?: boolean;
  cost?: boolean;
};

/** One titled block of the report, as the game's own report draws one. */
export type Block = {
  label: string;
  rows: (Row | null)[];
  /** The two value columns' headings, for a block that has two. */
  columns?: readonly [string, string];
};

/** A block: its heading, then a line per row, and nothing when it is empty. */
export function ReportBlock({ block }: { block: Block }) {
  const rows = block.rows.filter((row): row is Row => row !== null);
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground mb-1 flex items-baseline justify-between gap-3 text-xs font-medium uppercase tracking-wide">
        <h4>{block.label}</h4>
        {block.columns ? (
          <span className="flex shrink-0 gap-3 normal-case tracking-normal">
            <span className="w-24 text-end">{block.columns[0]}</span>
            <span className="w-24 text-end">{block.columns[1]}</span>
          </span>
        ) : null}
      </div>
      <dl className="text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 py-0.5"
          >
            <dt
              className={cn(
                // Takes the slack, so the values stay right however
                // many columns the block has.
                "min-w-0 flex-1 truncate",
                row.under && "text-muted-foreground ps-4",
              )}
            >
              {row.label}
            </dt>
            <dd
              className={cn(
                "shrink-0 tabular-nums",
                block.columns && "w-24 text-end",
                row.under && "text-muted-foreground",
                // A cost reads as a cost, which is the one thing a column
                // of positive numbers cannot say.
                row.cost && "text-red-500",
              )}
            >
              {row.value}
            </dd>
            {block.columns ? (
              <dd className="text-muted-foreground w-24 shrink-0 text-end tabular-nums">
                {row.free}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}
