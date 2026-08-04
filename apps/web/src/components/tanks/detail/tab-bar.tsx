import { HoverPrefetchLink as Link } from "@/components/hover-prefetch-link";
import { Panel, PanelHeader } from "@/components/panel";
import {
  TANK_DETAIL_TABS,
  type TankDetailTab,
  tankDetailTabHref,
} from "@/components/tanks/detail/tabs";
import { cn } from "@/lib/utils";

// Server tab bar for the tank detail page. Each tab is a route of its own, so
// this only renders the nav and the caller renders the one tab's content next to
// it. `available` lists the tabs that have something to show for this tank.
export function TankDetailTabs({
  basePath,
  active,
  available,
}: {
  basePath: string;
  active: TankDetailTab;
  available: TankDetailTab[];
}) {
  const tabs = TANK_DETAIL_TABS.filter((t) => available.includes(t.id));
  if (tabs.length === 0) return null;

  return (
    <Panel screenLines={false} className="screen-line-before">
      <PanelHeader className="px-0! py-0!" screenLines={false}>
        <nav className="flex items-center overflow-x-auto text-sm">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={tankDetailTabHref(basePath, t.id)}
              className={cn(
                "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap transition-colors",
                active === t.id
                  ? "bg-fd-secondary/40 text-fd-foreground"
                  : "text-fd-muted-foreground hover:bg-fd-secondary/20 hover:text-fd-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </PanelHeader>
    </Panel>
  );
}
