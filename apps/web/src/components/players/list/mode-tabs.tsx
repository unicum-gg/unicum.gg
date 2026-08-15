import Link from "next/link";
import { Panel, PanelHeader } from "@/components/panel";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";

function tabClass(active: boolean): string {
  return cn(
    "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap transition-colors",
    active
      ? "bg-fd-secondary/40 text-fd-foreground"
      : "text-fd-muted-foreground hover:bg-fd-secondary/20 hover:text-fd-foreground",
  );
}

// The game-mode tabs on the player landing: "Overall" (the WNX rating board at
// /players) and "Steel Hunter" (the HR battle-royale board at
// /players/steel-hunter). Mirrors the clan landing's StrongholdTierTabs so the
// two pages read as siblings. `active` highlights the current board.
export function PlayersModeTabs({
  region,
  active,
}: {
  region: Region;
  active: "overall" | "steel-hunter" | "onslaught";
}) {
  return (
    <Panel>
      <PanelHeader className="px-0! py-0!" screenLines={false}>
        <nav className="flex items-center overflow-x-auto text-sm">
          <Link
            href={ROUTES.PLAYERS(region)}
            className={tabClass(active === "overall")}
          >
            Overall
          </Link>
          <Link
            href={ROUTES.PLAYERS_STEEL_HUNTER(region)}
            className={tabClass(active === "steel-hunter")}
          >
            Steel Hunter
          </Link>
          <Link
            href={ROUTES.PLAYERS_ONSLAUGHT(region)}
            className={tabClass(active === "onslaught")}
          >
            Onslaught
          </Link>
        </nav>
      </PanelHeader>
    </Panel>
  );
}
