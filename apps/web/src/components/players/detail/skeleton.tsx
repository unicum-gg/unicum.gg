import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/table-skeleton";
import { PlayerHeader } from "@/components/players/detail/header";
import { PlayerStatsTable } from "@/components/players/detail/overview/stats-table";
import {
  STEEL_HUNTER_ROWS,
  StrongholdStatsTable,
} from "@/components/players/detail/overview/stronghold-stats-table";
import { TanksLiftDrag } from "@/components/players/detail/overview/tanks-lift-drag";
import { PlayerClansHistory } from "@/components/players/detail/overview/clans-history";
import { ValueTab } from "@/components/players/detail/value";
import { TANKS_SKELETON_COLUMNS } from "@/components/players/detail/tanks/skeleton-columns";
import {
  PLAYER_MODES,
  PLAYER_SECTIONS,
  PlayerMode,
  PlayerSection,
} from "@/components/players/detail/tabs";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

// Mode → panel-title label, mirroring STRONGHOLD_MODES in tabs-view.
const STRONGHOLD_LABEL: Partial<Record<PlayerMode, string>> = {
  [PlayerMode.Skirmish]: "skirmish",
  [PlayerMode.Advances]: "advances",
  [PlayerMode.GrandBattles]: "grand battles",
  [PlayerMode.RankedBattles]: "ranked battles",
  [PlayerMode.ClanWarsX]: "Clan Wars Tier X",
  [PlayerMode.ClanWarsVIII]: "Clan Wars Tier VIII",
  [PlayerMode.ClanWarsVI]: "Clan Wars Tier VI",
  [PlayerMode.SteelHunter]: "Steel Hunter",
};

/** One nav row as inert spans, matching PlayerSectionNav/PlayerModeNav so the
 * tabs look identical (and the same one is highlighted) while the page loads. */
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

/** The Overview + Random Battles layout: the real components in `loading` mode
 * so nothing is re-implemented here (the tables/lists own their own skeletons). */
function OverviewSkeleton({
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
          <PlayerStatsTable loading />
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
          <TanksLiftDrag loading metricLabel={metricLabel} />
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <PlayerClansHistory loading nickname={nickname} />
    </>
  );
}

/**
 * Full-fidelity placeholder for the player profile, shown while the detail loads
 * (Suspense fallback in the page). It composes the real components in their
 * `loading` mode, so the skeleton can never drift from what it stands in for.
 * The content matches the active section/mode so the fallback lines up with
 * whatever streams in (no layout jump on swap).
 */
export function PlayerProfileSkeleton({
  nickname,
  metricLabel,
  section,
  mode,
}: {
  nickname: string;
  metricLabel: string;
  section: PlayerSection;
  mode: PlayerMode;
}) {
  const onValue = section === PlayerSection.Value;
  const onTanks = section === PlayerSection.Tanks;
  // The mode row only shows under Overview, matching PlayerTabsView.
  const showModes = !onValue && !onTanks;
  const strongholdLabel = showModes ? STRONGHOLD_LABEL[mode] : undefined;

  return (
    <>
      <Panel>
        <PanelContent className="p-0">
          <PlayerHeader loading nickname={nickname} />
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelHeader className="px-0! py-0!" screenLines={false}>
          <StaticNav items={PLAYER_SECTIONS} activeId={section} />
        </PanelHeader>
      </Panel>

      {showModes && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader className="px-0! py-0!" screenLines={false}>
              <StaticNav items={PLAYER_MODES} activeId={mode} />
            </PanelHeader>
          </Panel>
        </>
      )}

      {onValue ? (
        <ValueTab loading nickname={nickname} />
      ) : onTanks ? (
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
      ) : strongholdLabel ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>
                {nickname}&apos;s {strongholdLabel} stats
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <StrongholdStatsTable
                loading
                trailingRows={
                  mode === PlayerMode.SteelHunter ? STEEL_HUNTER_ROWS : undefined
                }
              />
            </PanelContent>
          </Panel>
        </>
      ) : (
        <OverviewSkeleton nickname={nickname} metricLabel={metricLabel} />
      )}
    </>
  );
}
