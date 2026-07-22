import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TableSkeleton,
  type SkeletonColumn,
} from "@/components/table-skeleton";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

// The Overview stats rows, in PlayerStatsTable's exact order (Tier after Battles,
// the four damage-breakdown rows after Damages). Static, so the skeleton shows
// the real left column and only the numeric cells are placeholders.
const OVERVIEW_STAT_ROWS = [
  "Battles",
  "Tier",
  "Wins",
  "Losses",
  "Draws",
  "Battles survived",
  "Tanks destroyed",
  "Destruction ratio",
  "Tanks spotted",
  "Damages",
  "Track damages",
  "Spotting damages",
  "Assisting damages",
  "Combined damages",
  "Base capture",
  "Base defense",
  "Experience",
  "Hit rate",
  "Personal rating",
  "World of Tanks Rating",
  "WN7",
  "WN8",
  "WNX",
];

// StrongholdStatsTable's rows (no Tier / damage-breakdown / WN rows).
const STRONGHOLD_STAT_ROWS = [
  "Battles",
  "Wins",
  "Losses",
  "Draws",
  "Battles survived",
  "Tanks destroyed",
  "Destruction ratio",
  "Tanks spotted",
  "Damages",
  "Base capture",
  "Base defense",
  "Experience",
];

// Mirrors PlayerTanksTable's columns (see tabs-view's TANKS_SKELETON_COLUMNS).
const TANKS_SKELETON_COLUMNS: SkeletonColumn[] = [
  { width: "w-6", align: "center" },
  { width: "w-6", align: "center" },
  { width: "w-6", align: "center" },
  { width: "w-28" },
  { width: "w-6", align: "center" },
  { width: "w-8", align: "center" },
  { width: "w-14", align: "right" },
  { width: "w-12", align: "right" },
  { width: "w-12", align: "right" },
  { width: "w-12", align: "right" },
  { width: "w-14", align: "right" },
];

/** A value-cell placeholder spanning one period's two sub-columns, right-aligned
 * like the real numbers. */
function ValueCell({ hideOnMobile }: { hideOnMobile?: boolean }) {
  return (
    <TableCell
      colSpan={2}
      className={cn("py-1.5! text-right", hideOnMobile && "max-sm:hidden")}
    >
      <Skeleton className="ml-auto h-4 w-12" />
    </TableCell>
  );
}

/** The stats/stronghold table skeleton: real headers + real row labels, only the
 * numeric cells are placeholders. `rows` is the label list (23 for Overview, 12
 * for stronghold), so it lines up with whichever table it stands in for. */
function StatsTableSkeleton({ rows }: { rows: string[] }) {
  return (
    <Table className="my-0! table-fixed [&_td]:min-w-0 [&_tr>*+*]:border-l [&_tr>*:first-child]:pl-4! [&_tr>*]:border-border [&_th]:py-1! [&_td]:py-0.5!">
      <colgroup>
        <col />
        <col className="w-[20%] sm:w-[9%]" />
        <col className="w-[20%] sm:w-[9%]" />
        <col className="max-sm:w-0! sm:w-[9%]" />
        <col className="max-sm:w-0! sm:w-[9%]" />
        <col className="max-sm:w-0! sm:w-[9%]" />
        <col className="max-sm:w-0! sm:w-[9%]" />
        <col className="w-[20%] sm:w-[9%]" />
        <col className="w-[20%] sm:w-[9%]" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>Stat</TableHead>
          <TableHead className="text-right" colSpan={2}>
            Total
          </TableHead>
          <TableHead className="text-right max-sm:hidden" colSpan={2}>
            Last 24h
          </TableHead>
          <TableHead className="text-right max-sm:hidden" colSpan={2}>
            Last 7d
          </TableHead>
          <TableHead className="text-right" colSpan={2}>
            Last 30d
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((label) => (
          <TableRow key={label}>
            <TableCell className="py-1.5! font-medium">{label}</TableCell>
            <ValueCell />
            <ValueCell hideOnMobile />
            <ValueCell hideOnMobile />
            <ValueCell />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LiftDragColumnSkeleton({ kind }: { kind: "lift" | "drag" }) {
  const isLift = kind === "lift";
  return (
    <div className="bg-fd-card">
      <div className="border-b border-fd-border px-4 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">
            {isLift ? "🚀 Lifting the rating" : "⚓ Dragging the rating"}
          </span>
          <Skeleton className="h-3 w-8" />
        </div>
        <p className="mt-0.5 text-xs text-fd-muted-foreground">
          {isLift
            ? "Tanks that prop the overall up: dropping them would lower the rating."
            : "Tanks that weigh the overall down: dropping them would raise the rating."}
        </p>
      </div>
      <ul>
        {Array.from({ length: 5 }, (_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 border-b border-fd-border/40 px-4 py-2 last:border-fd-border"
          >
            <span className="flex w-10 shrink-0 items-center justify-center">
              <Skeleton className="h-3 w-8" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                <Skeleton className="h-3.5 w-28" />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 tabular-nums">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClansHistorySkeleton({ nickname }: { nickname: string }) {
  const HEADS = ["Tag", "Name", "Role", "From", "To", "Duration"];
  return (
    <Panel>
      <PanelHeader>
        <div className="flex items-baseline justify-between gap-4">
          <PanelTitle>{nickname}&apos;s clans history</PanelTitle>
          <Skeleton className="h-3 w-36" />
        </div>
      </PanelHeader>
      <PanelContent className="p-0">
        <div className="p-4">
          <Skeleton className="h-19 w-full rounded-md" />
        </div>
        <Table className="my-0! border-t border-fd-border [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-3! [&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-3!">
          <TableHeader>
            <TableRow>
              {HEADS.map((h, i) => (
                <TableHead
                  key={h}
                  className={cn(
                    "px-3 py-2",
                    (i === 2 || i === 3) && "hidden sm:table-cell",
                    i === 5 && "text-right",
                  )}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 4 }, (_, r) => (
              <TableRow key={r}>
                <TableCell className="pl-4!">
                  <Skeleton className="h-4 w-14" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-5 shrink-0 rounded-sm" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="pr-3!">
                  <Skeleton className="ml-auto h-4 w-16" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </PanelContent>
    </Panel>
  );
}

/** Overview + Random Battles: the default, richest layout. */
export function OverviewContentSkeleton({
  nickname,
  metricLabel,
}: {
  nickname: string;
  metricLabel: string;
}) {
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{nickname}&apos;s random battles stats</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <StatsTableSkeleton rows={OVERVIEW_STAT_ROWS} />
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            {nickname}&apos;s {metricLabel} progression
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {/* The description is static text, so render it for real (matches the
              loaded page's height); the chart area mirrors the h-56 placeholder. */}
          <div className={`p-4 ${styles.mutedDescription}`}>
            Solid line is overall {metricLabel} (matches the Total column above),
            drifting slowly as new battles accumulate. Dashed line is per-session{" "}
            {metricLabel}, computed from the battles played since the previous
            snapshot. It shows hot and cold streaks. Line color follows the
            rating tier.
          </div>
          <div className="px-4 pb-4">
            <Skeleton className="h-56 w-full rounded-md" />
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>Tanks shaping {nickname}&apos;s rating</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="grid gap-px bg-fd-border md:grid-cols-2">
            <LiftDragColumnSkeleton kind="lift" />
            <LiftDragColumnSkeleton kind="drag" />
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <ClansHistorySkeleton nickname={nickname} />
    </>
  );
}

/** A stronghold mode (Skirmish, Advances, …): a single stronghold-style table. */
export function StrongholdContentSkeleton({
  nickname,
  label,
}: {
  nickname: string;
  label: string;
}) {
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            {nickname}&apos;s {label} stats
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <StatsTableSkeleton rows={STRONGHOLD_STAT_ROWS} />
        </PanelContent>
      </Panel>
    </>
  );
}

/** The Tanks section: the on-demand per-tank table. */
export function TanksContentSkeleton({ nickname }: { nickname: string }) {
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{nickname}&apos;s tanks</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <TableSkeleton columns={TANKS_SKELETON_COLUMNS} rows={12} />
        </PanelContent>
      </Panel>
    </>
  );
}

/** The Value section: the two side-by-side account valuations. */
export function ValueContentSkeleton({ nickname }: { nickname: string }) {
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{nickname}&apos;s account value</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-px p-0 md:grid-cols-2">
          <section className="space-y-3 p-6">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-md" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
            <Skeleton className="h-10 w-40" />
            <div className="space-y-2.5 border-t border-fd-border pt-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-2"
                >
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </section>
          <section className="space-y-3 p-6">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-md" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
            <Skeleton className="h-10 w-40" />
            <div className={`space-y-1.5 ${styles.mutedDescription}`}>
              <Skeleton className="h-3 w-full max-w-md" />
              <Skeleton className="h-3 w-full max-w-sm" />
              <Skeleton className="h-3 w-2/3 max-w-xs" />
            </div>
            <div className="flex flex-wrap gap-4 border-t border-fd-border pt-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-28" />
            </div>
          </section>
        </PanelContent>
      </Panel>
      <PanelSeparator />
      <Panel>
        <PanelContent className="space-y-1.5 px-4 py-4">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </PanelContent>
      </Panel>
    </>
  );
}
