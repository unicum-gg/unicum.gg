"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { ShareButton } from "@/components/share-button";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { VehicleMeta } from "@/services/wargaming/wot/vehicle-meta";
import {
  type WN8Expected,
  type WNXExpected,
} from "@/services/wargaming/wot/ratings";
import type { Region } from "@unicum.gg/wargaming/region";
import { BucketTab } from "./bucket-tab";
import { OverallTab } from "./overall-tab";
import { PerTankTab } from "./per-tank-tab";
import type { CompareSlot } from "./comparison-table";
import { SlotHeader } from "./slot-header";

enum CompareTab {
  Overall = "overall",
  PerClass = "per-class",
  PerTier = "per-tier",
  PerTank = "per-tank",
}

const TABS: { id: CompareTab; label: string; query: string | null }[] = [
  { id: CompareTab.Overall, label: "Overall", query: null },
  { id: CompareTab.PerClass, label: "Per class", query: "class" },
  { id: CompareTab.PerTier, label: "Per tier", query: "tier" },
  { id: CompareTab.PerTank, label: "Per tank", query: "tank" },
];

function tabFromQuery(query: string | null): CompareTab {
  const found = TABS.find((t) => t.query === query);
  return found ? found.id : CompareTab.Overall;
}

export function PlayerCompareView({
  region,
  slots,
  encyclopedia,
  wn8Expected,
  wnxExpected,
  maxPlayers,
}: {
  region: Region;
  slots: CompareSlot[];
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
  maxPlayers: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = tabFromQuery(searchParams.get("tab"));

  function setTab(next: CompareTab) {
    const def = TABS.find((t) => t.id === next);
    const params = new URLSearchParams(searchParams.toString());
    if (!def?.query) params.delete("tab");
    else params.set("tab", def.query);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const canAddMore = slots.length < maxPlayers;

  function navigateWith(nicks: string[]) {
    if (nicks.length < 2) {
      router.push(ROUTES.PLAYER(region, nicks[0] ?? slots[0].requested));
      return;
    }
    router.push(ROUTES.COMPARE_PLAYERS(region, nicks));
  }

  function onRemove(idx: number) {
    const next = slots.filter((_, i) => i !== idx).map((s) => s.requested);
    navigateWith(next);
  }

  function onAdd(nickname: string) {
    const next = [...slots.map((s) => s.requested), nickname];
    navigateWith(next);
  }

  return (
    <>
      <Panel>
        <PanelHeader className="flex items-center justify-between gap-2">
          <PanelTitle>Compare</PanelTitle>
          <ShareButton
            title="Share comparison"
            url={`${APP.URL}${ROUTES.COMPARE_PLAYERS(
              region,
              slots.map((s) => s.requested),
            )}`}
            shareText={`${slots
              .map((s) => s.requested)
              .join(" vs ")} compared on ${APP.NAME}`}
            ogImage={`${APP.URL}/api/og/${region}/players/compare?names=${slots
              .map((s) => encodeURIComponent(s.requested))
              .join(",")}`}
          />
        </PanelHeader>
        <PanelContent className="p-4">
          <SlotHeader
            region={region}
            slots={slots}
            canAddMore={canAddMore}
            onRemove={onRemove}
            onAdd={onAdd}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader className="px-0! py-0!">
          <nav className="flex items-center overflow-x-auto text-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "cursor-pointer border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap transition-colors",
                  tab === t.id
                    ? "bg-fd-secondary/40 text-fd-foreground"
                    : "text-fd-muted-foreground hover:bg-fd-secondary/20 hover:text-fd-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </PanelHeader>
        <PanelContent className="p-0">
          {tab === CompareTab.Overall && (
            <OverallTab
              slots={slots}
              encyclopedia={encyclopedia}
              wn8Expected={wn8Expected}
              wnxExpected={wnxExpected}
            />
          )}
          {tab === CompareTab.PerClass && (
            <BucketTab
              slots={slots}
              encyclopedia={encyclopedia}
              wn8Expected={wn8Expected}
              wnxExpected={wnxExpected}
              bucketKey="class"
            />
          )}
          {tab === CompareTab.PerTier && (
            <BucketTab
              slots={slots}
              encyclopedia={encyclopedia}
              wn8Expected={wn8Expected}
              wnxExpected={wnxExpected}
              bucketKey="tier"
            />
          )}
          {tab === CompareTab.PerTank && (
            <PerTankTab
              slots={slots}
              encyclopedia={encyclopedia}
              wn8Expected={wn8Expected}
              wnxExpected={wnxExpected}
            />
          )}
        </PanelContent>
      </Panel>
    </>
  );
}

