import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/table-skeleton";
import { ClanHeader } from "@/components/clans/detail/header";
import { ClanMembersTable } from "@/components/clans/detail/overview/members-table";
import { ClanRecentActivity } from "@/components/clans/detail/overview/recent-activity";
import { ClanStrongholdStatsTable } from "@/components/clans/detail/overview/stronghold-stats";
import { ClanWarsStatsTable } from "@/components/clans/detail/overview/clan-wars-stats";
import { VEHICLES_SKELETON_COLUMNS } from "@/components/clans/detail/tanks/columns";
import {
  CLAN_MODES,
  CLAN_SECTIONS,
  ClanMode,
  ClanSection,
} from "@/components/clans/detail/tabs";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";

/** `[TAG] {children}` panel title, matching TaggedTitle in tabs-view. */
function TaggedTitle({
  tag,
  color,
  children,
}: {
  tag: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <PanelTitle>
      <span style={{ color }}>[</span>
      {tag}
      <span style={{ color }}>]</span> {children}
    </PanelTitle>
  );
}

/** One nav row as inert spans, matching ClanSectionNav/ClanModeNav so the tabs
 * look identical (and the same one is highlighted) while the page loads. */
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

/**
 * Full-fidelity placeholder for the clan profile, shown while the detail loads
 * (Suspense fallback in the page). It composes the real components in their
 * `loading` mode, so the skeleton can't drift from what it stands in for, and
 * matches the active section/mode so the fallback lines up with what streams in.
 */
export function ClanProfileSkeleton({
  region,
  tag,
  color,
  section,
  mode,
}: {
  region: Region;
  tag: string;
  color: string;
  section: ClanSection;
  mode: ClanMode;
}) {
  const onTanks = section === ClanSection.Tanks;

  return (
    <>
      <Panel>
        <PanelContent className="p-0">
          <ClanHeader loading region={region} tag={tag} color={color} />
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <StaticNav items={CLAN_SECTIONS} activeId={section} />
        </PanelHeader>
      </Panel>

      {/* The clan description sits on every section (between the section and mode
          rows) and usually overflows, so it reserves the full 10-line clamp
          (ExpandableDescription's `maxLines`) — matching the common case with no
          mid-page shift. Same `space-y-2 text-sm` prose + a "See more" line. */}
      <PanelSeparator />
      <Panel>
        <PanelContent>
          {/* Tight line-boxes (no inter-line gap) mimic the `-webkit-line-clamp`
              text block, so 10 lines land at the real clamped height. */}
          <div>
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="flex h-5.25 items-center">
                <Skeleton
                  className={cn(
                    "h-3.5",
                    i === 9 ? "w-1/2" : i % 3 === 2 ? "w-11/12" : "w-full",
                  )}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex h-4 items-center">
            <Skeleton className="h-3 w-16" />
          </div>
        </PanelContent>
      </Panel>

      {!onTanks && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader className="px-0! py-0!" screenLines={false}>
              <StaticNav items={CLAN_MODES} activeId={mode} />
            </PanelHeader>
          </Panel>
        </>
      )}

      {onTanks ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <TaggedTitle tag={tag} color={color}>
                tanks
              </TaggedTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <TableSkeleton columns={VEHICLES_SKELETON_COLUMNS} rows={12} />
            </PanelContent>
          </Panel>
        </>
      ) : mode === ClanMode.Stronghold ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <TaggedTitle tag={tag} color={color}>
                stronghold stats
              </TaggedTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <ClanStrongholdStatsTable loading />
            </PanelContent>
          </Panel>
        </>
      ) : mode === ClanMode.ClanWars ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <TaggedTitle tag={tag} color={color}>
                clan wars stats
              </TaggedTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <ClanWarsStatsTable loading />
            </PanelContent>
          </Panel>
        </>
      ) : (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <TaggedTitle tag={tag} color={color}>
                members random battles stats
              </TaggedTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <ClanMembersTable loading />
            </PanelContent>
          </Panel>

          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <TaggedTitle tag={tag} color={color}>
                recent activity
              </TaggedTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <ClanRecentActivity loading />
            </PanelContent>
          </Panel>
        </>
      )}
    </>
  );
}
