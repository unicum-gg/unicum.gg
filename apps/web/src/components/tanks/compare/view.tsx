"use client";

import { statLabel } from "@/components/stat-label";

import { useTranslation } from "@/hooks/use-translation";
import { useStatLabels } from "@/hooks/use-stat-labels";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/hooks/use-router";
import { PlusIcon } from "@phosphor-icons/react";
import type { Region } from "@unicum.gg/wargaming";
import type {
  CompareCatalog,
  CompareVehicle,
} from "@unicum.gg/core/wargaming/wot/tanks/compare-assemble";
import type { SpecRanges } from "@unicum.gg/core/wargaming/wot/tanks/spec-ranges";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { ShareButton } from "@/components/share-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TankSearchPopover } from "@/components/tanks/tank-search-popover";
import {
  decodeSetup,
  decodeSetups,
  encodeSetups,
  SETUP_PARAM,
} from "@/components/tanks/detail/specifications/config-url";
import { TankCompareColumnHeader } from "@/components/tanks/compare/column-header";
import { TankCompareGrid } from "@/components/tanks/compare/characteristics-grid";
import { TankComparePerformancesGrid } from "@/components/tanks/compare/performances-grid";
import { toBuildData } from "@/components/tanks/compare/vehicle-data";
import { bestOverall, overallScore } from "@/components/tanks/compare/score";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { unicumPublic } from "@/services/sdk";
import { MAX_COMPARE_TANKS } from "@/constants/compare";
import {
  columnClient,
  columnOccurrence,
  vehicleLabel,
  vehicleRef,
} from "@/components/tanks/compare/column-ref";
import { useCompareBuilds } from "@/hooks/use-compare-builds";
import {
  formatTankRef,
  normalizeTankRefs,
  parseTankRef,
  TankClient,
} from "@unicum.gg/shared";
import { cn } from "@/lib/utils";

enum CompareTab {
  Characteristics = "characteristics",
  Performances = "performances",
}

const TABS: { id: CompareTab; label: string; query: string | null }[] = [
  { id: CompareTab.Characteristics, label: "Characteristics", query: null },
  { id: CompareTab.Performances, label: "Performances", query: "performances" },
];

function tabFromQuery(query: string | null): CompareTab {
  return TABS.find((t) => t.query === query)?.id ?? CompareTab.Characteristics;
}

/**
 * Vehicles side by side, the game's Compare Vehicles screen.
 *
 * Every column is a live build of the same kind the tank page holds, so the
 * numbers move with the ammunition, equipment, crew and progression set on it,
 * and the whole board (which vehicles, and how each is set up) fits in the URL,
 * so a comparison is something you send someone rather than something you
 * describe.
 *
 * The caller must remount this on a change of composition (`key` over the
 * slugs): column state is held by index, see `useCompareBuilds`.
 */
export function TankCompareView({
  region,
  vehicles,
  catalog,
  ranges,
}: {
  region: Region;
  vehicles: CompareVehicle[];
  catalog: CompareCatalog;
  ranges: SpecRanges;
}) {
  const { t: tStats } = useStatLabels();
  const { t } = useTranslation("components/tanks/compare/view");
  const router = useRouter();
  const searchParams = useSearchParams();
  // Client state, not a route: `router.replace` would re-render the server page
  // (refetching the whole comparison) and change the key it mounts this board
  // with, resetting the pinned column and every build. The URL still follows,
  // through the same replaceState the setups use.
  const [tab, setTab] = useState(() => tabFromQuery(searchParams.get("tab")));

  // Each column's build data, and the setup the URL opened it on. Both are read
  // once per composition: the builds own their state from there.
  const data = useMemo(
    () => vehicles.map((v) => toBuildData(v, catalog)),
    [vehicles, catalog],
  );
  const [seeds] = useState(() =>
    decodeSetups(searchParams.get(SETUP_PARAM), vehicles.length).map((token) =>
      decodeSetup(token),
    ),
  );

  const builds = useCompareBuilds(data, seeds);
  const [pinned, setPinned] = useState<number | null>(0);

  const tokens = builds.map((b) => b.setupToken);
  const setups = encodeSetups(tokens);
  const tabQuery = TABS.find((t) => t.id === tab)?.query ?? null;

  // Mirror the board into the URL (replaceState, so no navigation, no scroll and
  // no server render): every column's setup in the one `setup` param, plus the
  // open tab. What is on screen is what a copied link reopens, and a pristine
  // comparison on the default tab writes no params at all.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.delete(SETUP_PARAM);
    if (setups) params.set(SETUP_PARAM, setups);
    params.delete("tab");
    if (tabQuery) params.set("tab", tabQuery);
    const qs = params.toString();
    const url = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    const current = `${window.location.pathname}${window.location.search}`;
    if (url !== current) window.history.replaceState(null, "", url);
  }, [setups, tabQuery]);

  /** Navigate to another composition, carrying each surviving column's setup so
   * adding or removing a vehicle never costs the others their build.
   *
   * The refs are normalized here rather than left to the page's canonical
   * redirect, so a composition change lands on its final URL in one navigation:
   * taking out the first of two columns on the same vehicle renumbers the one
   * that stays, and it would otherwise arrive at `is-7~2` alone and bounce.
   * Normalizing preserves the order, so the setups still line up. */
  function navigateTo(refs: string[], keep: (string | null)[]) {
    const columns = normalizeTankRefs(refs, MAX_COMPARE_TANKS);
    if (columns.length < 2) {
      // Below two there is nothing to compare, so the survivor gets its own
      // page. Its slug is read back out of the reference, which may carry a
      // client or a position that a tank page's URL has no room for.
      const last = columns[0] ? parseTankRef(columns[0]).slug : null;
      router.push(ROUTES.TANK(region, last ?? vehicles[0].slug));
      return;
    }
    const href = ROUTES.COMPARE_TANKS(region, columns);
    const carried = encodeSetups(keep);
    router.push(carried ? `${href}?${SETUP_PARAM}=${carried}` : href);
  }

  /** The reference a new column on this vehicle takes: one past the highest
   * position the comparison already gives it, since a repeat spelled exactly
   * like a column that is already there collapses instead of being added.
   * Normalization closes the gap this may leave. */
  function refForNewColumn(slug: string, client: TankClient): string {
    const taken = vehicles
      .filter((v) => v.slug === slug && columnClient(v) === client)
      .map(columnOccurrence);
    return formatTankRef({
      slug,
      client,
      occurrence: taken.length ? Math.max(...taken) + 1 : 1,
    });
  }

  function onRemove(idx: number) {
    navigateTo(
      vehicles.filter((_, i) => i !== idx).map(vehicleRef),
      tokens.filter((_, i) => i !== idx),
    );
  }

  function onAdd(slug: string) {
    navigateTo(
      [...vehicles.map(vehicleRef), refForNewColumn(slug, TankClient.Live)],
      [...tokens, null],
    );
  }

  /** The same vehicle again, beside the column it was taken from and carrying
   * its setup: the two columns start identical and the reader changes one, which
   * is the comparison a player runs before spending credits.
   *
   * Beside rather than appended, because a setup is read against the one it is
   * being weighed up against, and carrying the setup rather than starting
   * pristine because the question is almost never "against stock". */
  function onDuplicate(idx: number) {
    const source = vehicles[idx];
    const ref = refForNewColumn(source.slug, columnClient(source));
    const refs = vehicles.map(vehicleRef);
    refs.splice(idx + 1, 0, ref);
    const keep = [...tokens];
    keep.splice(idx + 1, 0, tokens[idx] ?? null);
    navigateTo(refs, keep);
  }

  /** Put one column's setup on all of them. A real navigation rather than a
   * state write: every column's build is seeded from the URL once and owns its
   * state from there, so the way to re-seed them all is to land on a URL that
   * says so (the page remounts the board on the setup it was given). */
  function onApplyToAll(setupToken: string) {
    const href = ROUTES.COMPARE_TANKS(region, vehicles.map(vehicleRef));
    const all = encodeSetups(vehicles.map(() => setupToken));
    router.push(all ? `${href}?${SETUP_PARAM}=${all}` : href);
  }

  // A comparison can hold one vehicle twice, once per game client, so the name
  // alone does not identify a column here either.
  const names = vehicles.map(vehicleLabel);
  const canAddMore = vehicles.length < MAX_COMPARE_TANKS;
  const columns = builds.map((b) => ({
    specs: b.finalSpecs,
    baseline: b.baselineSpec,
  }));

  // Which vehicle comes out on top, as configured right now: it moves with the
  // equipment and the crew, like everything else here.
  const scores = columns.map((c) => overallScore(c.specs, ranges));
  const best = bestOverall(scores);

  const headers = vehicles.map((vehicle, i) => (
    <TankCompareColumnHeader
      key={vehicleRef(vehicle)}
      region={region}
      vehicle={vehicle}
      data={data[i]}
      build={builds[i]}
      score={scores[i]}
      isBest={best.has(i)}
      pinned={pinned === i}
      onPin={() => setPinned(pinned === i ? null : i)}
      onRemove={vehicles.length > 2 ? () => onRemove(i) : undefined}
      onDuplicate={canAddMore ? () => onDuplicate(i) : undefined}
      onApplyToAll={onApplyToAll}
    />
  ));

  const shareUrl = `${APP.URL}${ROUTES.COMPARE_TANKS(
    region,
    vehicles.map(vehicleRef),
  )}${setups ? `?${SETUP_PARAM}=${setups}` : ""}`;

  return (
    <TooltipProvider delayDuration={150}>
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {/* The vehicles are the heading: this page is only ever about them,
              and it is the one thing a search result or a shared link shows. */}
            <PanelTitle>{names.join(" vs ")}</PanelTitle>
            {/* Nothing is excluded: a vehicle already in the comparison is a
                legitimate pick, since the same tank under two setups is one of
                the things this board is for. It joins as a column of its own
                rather than collapsing onto the one that is there. */}
            {canAddMore && (
              <TankSearchPopover
                region={region}
                onPick={(tank) => onAdd(tank.slug)}
                triggerAriaLabel={t("add-a-vehicle")}
                tooltip={t("add-a-vehicle")}
                placeholder={t("add-a-tank")}
                triggerClassName="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-fd-border bg-fd-secondary/30 px-2.5 text-xs text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground"
                triggerContent={
                  <>
                    <PlusIcon className="size-3" weight="bold" />
                    Add
                  </>
                }
              />
            )}
          </div>
          <ShareButton
            title={t("share-comparison")}
            url={shareUrl}
            shareText={t("share-text", {
              names: names.join(" vs "),
              app: APP.NAME,
            })}
            ogImage={unicumPublic.og
              .region(region)
              .tanks.compare(vehicles.map(vehicleRef))
              .url()}
          />
        </PanelHeader>

        <nav className="flex items-center border-b border-fd-border text-sm">
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
              {statLabel(t.label, tStats)}
            </button>
          ))}
        </nav>

        <PanelContent className="p-0">
          {tab === CompareTab.Characteristics ? (
            <TankCompareGrid
              columns={columns}
              ranges={ranges}
              pinned={pinned}
              headers={headers}
            />
          ) : (
            <TankComparePerformancesGrid
              vehicles={vehicles}
              headers={headers}
            />
          )}
        </PanelContent>
      </Panel>
    </TooltipProvider>
  );
}
