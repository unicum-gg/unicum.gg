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
import type { Region } from "@/services/wargaming/wot";
import { BucketTab } from "./bucket-tab";
import type { ClanCompareSlot } from "./comparison-table";
import { OverallTab } from "./overall-tab";
import { PerTankTab } from "./per-tank-tab";
import { SlotHeader } from "./slot-header";
import { TopMembersTab } from "./top-members-tab";

enum CompareTab {
  Overall = "overall",
  TopMembers = "top-members",
  PerClass = "per-class",
  PerTier = "per-tier",
  PerTank = "per-tank",
}

const TABS: { id: CompareTab; label: string; query: string | null }[] = [
  { id: CompareTab.Overall, label: "Overall", query: null },
  { id: CompareTab.TopMembers, label: "Top members", query: "top" },
  { id: CompareTab.PerClass, label: "Per class", query: "class" },
  { id: CompareTab.PerTier, label: "Per tier", query: "tier" },
  { id: CompareTab.PerTank, label: "Per tank", query: "tank" },
];

function tabFromQuery(query: string | null): CompareTab {
  const found = TABS.find((t) => t.query === query);
  return found ? found.id : CompareTab.Overall;
}

export function ClanCompareView({
  region,
  slots,
  encyclopedia,
  wn8Expected,
  wnxExpected,
  maxClans,
}: {
  region: Region;
  slots: ClanCompareSlot[];
  encyclopedia: Record<string, VehicleMeta>;
  wn8Expected: Map<number, WN8Expected>;
  wnxExpected: Map<number, WNXExpected>;
  maxClans: number;
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

  const canAddMore = slots.length < maxClans;

  function navigateWith(tags: string[]) {
    if (tags.length < 2) {
      router.push(ROUTES.CLAN(region, tags[0] ?? slots[0].requested));
      return;
    }
    router.push(ROUTES.COMPARE_CLANS(region, tags));
  }

  function onRemove(idx: number) {
    const next = slots.filter((_, i) => i !== idx).map((s) => s.requested);
    navigateWith(next);
  }

  function onAdd(tag: string) {
    const next = [...slots.map((s) => s.requested), tag];
    navigateWith(next);
  }

  return (
    <>
      <Panel>
        <PanelHeader className="flex items-center justify-between gap-2">
          <PanelTitle>Compare</PanelTitle>
          <ShareButton
            title="Share comparison"
            url={`${APP.URL}${ROUTES.COMPARE_CLANS(
              region,
              slots.map((s) => s.requested),
            )}`}
            shareText={`${slots
              .map((s) => `[${s.clan?.tag ?? s.requested}]`)
              .join(" vs ")} compared on ${APP.NAME}`}
            ogImage={`${APP.URL}/api/og/${region}/clans/compare?tags=${slots
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
            <OverallTab region={region} slots={slots} />
          )}
          {tab === CompareTab.TopMembers && (
            <TopMembersTab region={region} slots={slots} />
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
