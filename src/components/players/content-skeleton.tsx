import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TableSkeleton, type SkeletonColumn } from "@/components/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Suspense fallback for the player page's data-heavy content (everything below
// the header, which streams once buildPlayerDetail resolves). The header is
// rendered for real in the shell, so it is deliberately NOT part of this
// skeleton — only the two nav rows and the default Overview stats table are.
// Mirrors the real layout so the swap doesn't shift anything.

const STATS_SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: "w-28" }, // Stat
  { width: "w-20", align: "right" }, // Total
  { width: "w-16", align: "right" }, // Last 24h
  { width: "w-16", align: "right" }, // Last 7d
  { width: "w-16", align: "right" }, // Last 30d
];

const MODE_WIDTHS = ["w-24", "w-16", "w-20", "w-24", "w-24", "w-20"];

// The real stats table has a fixed set of 23 rows (see stats-table.tsx
// ROW_DEFS + the Tier/damage/WN expansions); matching the count keeps the panel
// the same height so nothing below it shifts when the real content streams in.
const STATS_ROW_COUNT = 23;

export function PlayerContentSkeleton() {
  return (
    <>
      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <div className="flex gap-6 px-4 py-3">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
        </PanelHeader>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <div className="flex gap-5 overflow-hidden px-4 py-3">
            {MODE_WIDTHS.map((w, i) => (
              <Skeleton key={i} className={`h-5 shrink-0 ${w}`} />
            ))}
          </div>
        </PanelHeader>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>
            <Skeleton className="h-6 w-56 max-w-full" />
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <TableSkeleton columns={STATS_SKELETON_COLUMNS} rows={STATS_ROW_COUNT} />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {/* Rating progression panel: reserves the space just below the stats
          table that peeks above the fold so nothing shifts when it streams in.
          The panels further down (lift/drag, clan history) are below the fold. */}
      <Panel>
        <PanelHeader>
          <PanelTitle>
            <Skeleton className="h-6 w-48 max-w-full" />
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-full max-w-3xl" />
            <Skeleton className="h-3 w-full max-w-2xl" />
            <Skeleton className="h-3 w-2/3 max-w-xl" />
          </div>
          <div className="px-4 pb-4">
            <Skeleton className="h-56 w-full" />
          </div>
        </PanelContent>
      </Panel>
    </>
  );
}
