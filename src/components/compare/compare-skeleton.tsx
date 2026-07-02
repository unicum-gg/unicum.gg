import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TableSkeleton, type SkeletonColumn } from "@/components/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Suspense fallback for the compare pages (player and clan). The number of
// slots comes from the URL, so the skeleton reserves the right number of value
// columns while the N entities + encyclopedia load. The "Compare" title and the
// tab labels are static, so they render for real.
const TAB_WIDTHS = ["w-14", "w-16", "w-14", "w-16"];

function compareColumns(count: number): SkeletonColumn[] {
  return [
    { width: "w-28" }, // stat label
    ...Array.from({ length: count }, () => ({
      width: "w-16",
      align: "right" as const,
    })),
  ];
}

export function CompareSkeleton({ count }: { count: number }) {
  return (
    <>
      <Panel>
        <PanelHeader>
          <PanelTitle>Compare</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-4">
          <div className="flex gap-3">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <Skeleton className="size-12 rounded-full" />
                <Skeleton className="h-4 w-24 max-w-full" />
                <Skeleton className="h-3 w-16 max-w-full" />
              </div>
            ))}
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <div className="flex gap-4 px-4 py-3">
            {TAB_WIDTHS.map((w, i) => (
              <Skeleton key={i} className={`h-5 ${w}`} />
            ))}
          </div>
        </PanelHeader>
        <PanelContent className="p-0">
          <TableSkeleton columns={compareColumns(count)} rows={12} />
        </PanelContent>
      </Panel>
    </>
  );
}
