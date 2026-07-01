import Link from "next/link";
import { cn } from "@/lib/utils";

export enum PlayerTab {
  Overall = "overall",
  Skirmish = "skirmish",
  Advances = "advances",
  GrandBattles = "grand",
  RankedBattles = "ranked",
  ClanWarsX = "cw-x",
  ClanWarsVIII = "cw-viii",
  ClanWarsVI = "cw-vi",
  SteelHunter = "steel-hunter",
}

const TABS: { id: PlayerTab; label: string; query: string | null }[] = [
  { id: PlayerTab.Overall, label: "Overall", query: null },
  { id: PlayerTab.Skirmish, label: "Skirmish", query: "skirmish" },
  { id: PlayerTab.Advances, label: "Advances", query: "advances" },
  { id: PlayerTab.GrandBattles, label: "Grand Battles", query: "grand" },
  { id: PlayerTab.RankedBattles, label: "Ranked Battles", query: "ranked" },
  { id: PlayerTab.ClanWarsX, label: "Clan Wars X", query: "cw-x" },
  { id: PlayerTab.ClanWarsVIII, label: "Clan Wars VIII", query: "cw-viii" },
  { id: PlayerTab.ClanWarsVI, label: "Clan Wars VI", query: "cw-vi" },
  { id: PlayerTab.SteelHunter, label: "Steel Hunter", query: "steel-hunter" },
];

export function tabFromQuery(query: string | null | undefined): PlayerTab {
  const found = TABS.find((t) => t.query === query);
  return found ? found.id : PlayerTab.Overall;
}

export function PlayerTabsNav({
  basePath,
  activeTab,
}: {
  basePath: string;
  activeTab: PlayerTab;
}) {
  return (
    <nav className="flex items-center overflow-x-auto text-sm">
      {TABS.map((t) => {
        const href = t.query ? `${basePath}?tab=${t.query}` : basePath;
        return (
          <Link
            key={t.id}
            href={href}
            scroll={false}
            className={cn(
              "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap transition-colors",
              activeTab === t.id
                ? "bg-fd-secondary/40 text-fd-foreground"
                : "text-fd-muted-foreground hover:bg-fd-secondary/20 hover:text-fd-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
