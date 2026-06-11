import Link from "next/link";
import { cn } from "@/lib/utils";

export enum ClanTab {
  Overview = "overview",
  Vehicles = "vehicles",
}

const TABS: { id: ClanTab; label: string; query: string | null }[] = [
  { id: ClanTab.Overview, label: "Overview", query: null },
  { id: ClanTab.Vehicles, label: "Vehicles", query: "vehicles" },
];

export function tabFromQuery(query: string | null | undefined): ClanTab {
  const found = TABS.find((t) => t.query === query);
  return found ? found.id : ClanTab.Overview;
}

export function ClanTabsNav({
  basePath,
  activeTab,
}: {
  basePath: string;
  activeTab: ClanTab;
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
