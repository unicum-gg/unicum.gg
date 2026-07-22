import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
} from "@/components/panel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OverviewContentSkeleton,
  StrongholdContentSkeleton,
  TanksContentSkeleton,
  ValueContentSkeleton,
} from "@/components/players/player-profile-skeleton-content";
import {
  PLAYER_MODES,
  PLAYER_SECTIONS,
  PlayerMode,
  PlayerSection,
} from "@/components/players/tabs";
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

function HeaderSkeleton({ nickname }: { nickname: string }) {
  // Mirrors PlayerHeader's structure so its line-boxes drive the height: the
  // size-24 clan emblem sets the header height, matching the loaded header.
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

/**
 * Full-fidelity placeholder for the player profile, shown while the detail loads
 * (Suspense fallback in the page). The static parts are the real thing — the
 * nickname, tab labels, panel titles, table headers and row labels — so only the
 * values are placeholders. The content matches the active section/mode so the
 * fallback lines up with whatever streams in (no layout jump on swap).
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
          <HeaderSkeleton nickname={nickname} />
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
        <ValueContentSkeleton nickname={nickname} />
      ) : onTanks ? (
        <TanksContentSkeleton nickname={nickname} />
      ) : strongholdLabel ? (
        <StrongholdContentSkeleton nickname={nickname} label={strongholdLabel} />
      ) : (
        <OverviewContentSkeleton nickname={nickname} metricLabel={metricLabel} />
      )}
    </>
  );
}
