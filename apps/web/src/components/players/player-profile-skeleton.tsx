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
  PLAYER_MODES,
  PLAYER_SECTIONS,
  PlayerMode,
  PlayerSection,
} from "@/components/players/tabs";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

// The stat rows, in the exact order PlayerStatsTable renders them (including the
// Tier row after Battles and the four damage-breakdown rows after Damages). The
// labels are static, so the skeleton shows the real left column and only the
// numeric cells are placeholders — the table reads as itself, just unfilled.
const STAT_ROWS = [
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

/** One nav row rendered as inert spans, matching PlayerSectionNav/PlayerModeNav
 * so the tabs look identical while the profile loads (they are not clickable
 * until the data lands and the real, interactive nav takes over). */
function StaticNav({
  items,
  activeId,
}: {
  items: { id: string; label: string }[];
  activeId: string;
}) {
  return (
    <nav className="flex items-center overflow-x-auto text-sm">
      {items.map((item) => (
        <span
          key={item.id}
          className={cn(
            "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap",
            item.id === activeId
              ? "bg-fd-secondary/40 text-fd-foreground"
              : "text-fd-muted-foreground",
          )}
        >
          {item.label}
        </span>
      ))}
    </nav>
  );
}

function HeaderSkeleton({ nickname }: { nickname: string }) {
  // Mirrors PlayerHeader's exact element structure so the line-boxes (not the
  // placeholder bars) drive the height: the size-24 clan emblem sets the header
  // height, matching the loaded header to the pixel.
  return (
    <header className="flex flex-col sm:flex-row sm:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
          <h1 className="min-w-0 flex-1 font-heading text-2xl font-bold tracking-tight wrap-break-word sm:text-4xl">
            {nickname}
          </h1>
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
        <div className="flex min-h-8 border-t border-fd-border sm:h-auto">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-y-0.5 px-4 py-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
            <Skeleton className="h-3 w-24" />
            <span className="hidden sm:inline">·</span>
            <Skeleton className="h-3 w-32" />
            <span className="hidden sm:inline">·</span>
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </div>
      {/* Clan block (the common case): the size-24 emblem sets the header
          height, so rendering it keeps the header from jumping when data lands. */}
      <div className="flex items-stretch border-t border-fd-border text-sm sm:border-t-0 sm:border-l">
        <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:flex-none sm:whitespace-nowrap sm:text-right">
          <div>
            <Skeleton className="inline-block h-3.5 w-40 align-middle sm:ml-auto" />
          </div>
          <div className="mt-1 text-xs">
            <Skeleton className="inline-block h-3 w-28 align-middle sm:ml-auto" />
          </div>
        </div>
        <div className="flex size-24 shrink-0 items-center justify-center border-l border-fd-border p-3">
          <Skeleton className="size-full rounded-md" />
        </div>
      </div>
    </header>
  );
}

/** A value cell placeholder spanning the two sub-columns of one period, right
 * aligned like the real numbers. */
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

function StatsTableSkeleton() {
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
        {STAT_ROWS.map((label) => (
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
            {/* Same text-sm / text-xs line-boxes as the real row so the height
                matches; only the text is a bar. */}
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

/**
 * Full-fidelity placeholder for the player profile, shown during a client-side
 * navigation while the detail loads over SWR (a direct/crawler hit renders the
 * real, server-fetched profile instead). Every static part is the real thing —
 * the nickname, the tab labels, the panel titles, the stat table's headers and
 * row labels — so only the numbers, chart and clan rows are placeholders. This
 * keeps the layout identical to the loaded page (no shift on swap).
 */
export function PlayerProfileSkeleton({
  nickname,
  metricLabel,
}: {
  nickname: string;
  metricLabel: string;
}) {
  return (
    <>
      <Panel>
        <PanelContent className="p-0">
          <HeaderSkeleton nickname={nickname} />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <StaticNav items={PLAYER_SECTIONS} activeId={PlayerSection.Overview} />
        </PanelHeader>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <StaticNav items={PLAYER_MODES} activeId={PlayerMode.Overall} />
        </PanelHeader>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{nickname}&apos;s random battles stats</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <StatsTableSkeleton />
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
          {/* The description is static text (no data), so render it for real; it
              matches the loaded page's height exactly. The chart area mirrors
              the real MountOnVisible placeholder (h-56). */}
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
