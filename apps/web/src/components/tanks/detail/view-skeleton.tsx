import Image from "next/image";
import { Fragment } from "react";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { TankConfigurator } from "@/components/tanks/detail/specifications/configurator";
import { TankTopPlayers } from "@/components/tanks/detail/performances/top-players";
import { TANK_DETAIL_TABS, TankDetailTab } from "@/components/tanks/detail/tabs";
import { cn } from "@/lib/utils";
import { Region, hangarBgUrl } from "@unicum.gg/wargaming";

/**
 * Full-fidelity placeholder for the tank detail page, shown while the composite
 * detail payload streams in (Suspense fallback in the page). It reuses the real
 * hero chrome (the hangar backdrop + gradients are known from the region alone,
 * so they render for real immediately), a static tab bar matching the active
 * tab, and per-tab content whose leaves (characteristics table, top-players
 * table) compose their own `loading` twins so they can't drift.
 */
export function TankViewSkeleton({
  region,
  tab,
}: {
  region: Region;
  tab: TankDetailTab;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <HeroSkeleton region={region} />
      <PanelSeparator />
      <StaticTabBar active={tab} />
      {tab === TankDetailTab.Performances ? (
        <PerformancesSkeleton />
      ) : tab === TankDetailTab.Marks ? (
        <MarksSkeleton />
      ) : (
        <SpecificationsSkeleton />
      )}
    </div>
  );
}

/** The hero: real hangar backdrop + gradients, with the vehicle render, badges,
 * name and description as placeholders. Same min-heights as the loaded hero. */
function HeroSkeleton({ region }: { region: Region }) {
  return (
    <Panel className="border-b border-fd-border">
      <div className="relative min-h-[320px] overflow-hidden sm:min-h-[400px] lg:min-h-[470px]">
        <Image
          src={hangarBgUrl(region, "webp")}
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="pointer-events-none object-cover object-center"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(52%_66%_at_57%_36%,var(--color-fd-secondary)/45%,transparent_72%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-r from-fd-background from-0% via-fd-background/30 via-26% to-transparent to-58%"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-fd-background from-0% via-fd-background/20 via-28% to-transparent to-55%"
        />
        <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5">
          <Skeleton className="size-8 rounded-md" />
        </div>
        <div className="absolute bottom-4 right-4 z-10 sm:bottom-6 sm:right-6">
          <Skeleton className="h-11 w-28 rounded-md" />
        </div>
        <div className="relative z-10 space-y-2 px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 w-5" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex h-10 items-center md:h-12">
            <Skeleton className="h-8 w-64 max-w-full md:h-10" />
          </div>
          <div className="max-w-sm space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** Inert twin of TankDetailTabs: the three real labels, active one highlighted,
 * so the tab bar looks identical while the content loads. */
function StaticTabBar({ active }: { active: TankDetailTab }) {
  return (
    <Panel screenLines={false} className="screen-line-before">
      <PanelHeader className="px-0! py-0!" screenLines={false}>
        <nav className="flex items-center overflow-x-auto text-sm">
          {TANK_DETAIL_TABS.map((t) => (
            <span
              key={t.id}
              className={cn(
                "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap",
                active === t.id
                  ? "bg-fd-secondary/40 text-fd-foreground"
                  : "text-fd-muted-foreground",
              )}
            >
              {t.label}
            </span>
          ))}
        </nav>
      </PanelHeader>
    </Panel>
  );
}

function SpecificationsSkeleton() {
  return (
    <>
      <ResearchRailSkeleton />
      <PanelSeparator />
      {/* The configurator owns its own layout skeleton (characteristics table +
          editors + modules rail), so the loading twin can't drift from it. */}
      <TankConfigurator loading />
      <PanelSeparator />
      <HistoricalReferenceSkeleton />
    </>
  );
}

/** The "{tank} historical reference" panel: a title over a paragraph of prose. */
function HistoricalReferenceSkeleton() {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          <Skeleton className="h-4 w-56" />
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="max-w-3xl space-y-1.5 px-4 py-4">
        {["w-full", "w-11/12", "w-2/3"].map((w, i) => (
          <div key={i} className="flex h-5.5 items-center">
            <Skeleton className={cn("h-3.5", w)} />
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}

/** The tech-tree branch: a header over a horizontal rail of ~7 node
 * placeholders (w-20 icon columns) joined by the same connector lines. */
function ResearchRailSkeleton() {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          <span className="flex h-7 items-center">
            <Skeleton className="h-4 w-48" />
          </span>
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="py-6">
        {/* Nodes and connectors are flat flex siblings (like the real
            ResearchRail), so the `flex-1` connectors stretch and spread the
            nodes across the full width instead of clumping them left. */}
        <div className="flex items-start overflow-hidden px-4">
          {Array.from({ length: 10 }, (_, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <div className="mt-2.5 h-px min-w-6 flex-1 bg-fd-border" />
              )}
              <div className="flex w-20 shrink-0 flex-col items-center gap-1.5">
                <div className="flex h-5 w-full items-center justify-center">
                  <Skeleton className="h-4 w-10" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Skeleton className="h-3.5 w-6" />
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </PanelContent>
    </Panel>
  );
}

/** A framed stat card: label bar over a value bar, matching the loaded Stat. */
function StatCard() {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-fd-border p-3">
      <div className="flex h-6 items-center">
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-6 w-14" />
    </div>
  );
}

function PerformancesSkeleton() {
  return (
    <>
      <Panel>
        <PanelHeader>
          <PanelTitle>
            <Skeleton className="h-4 w-44" />
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3 p-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-full max-w-2xl" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 12 }, (_, i) => (
              <StatCard key={i} />
            ))}
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelHeader className="flex items-center justify-between gap-3">
          <PanelTitle>
            <Skeleton className="h-4 w-52" />
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="px-4 py-3">
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <TankTopPlayers loading />
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            <Skeleton className="h-4 w-40" />
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-4 p-4">
          <Skeleton className="h-4 w-96 max-w-full" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <StatCard key={i} />
            ))}
          </div>
          <Skeleton className="h-3.5 w-full max-w-xl" />
        </PanelContent>
      </Panel>
    </>
  );
}

function MarksSkeleton() {
  return (
    <>
      <MarksSectionSkeleton rows={3} />
      <PanelSeparator />
      <MarksSectionSkeleton rows={4} />
    </>
  );
}

/** One marks panel: a 1/3 values column (icon + label / value rows) beside a
 * 2/3 chart column, matching MarksSection. */
function MarksSectionSkeleton({ rows }: { rows: number }) {
  return (
    <Panel>
      <div className="grid grid-cols-1 lg:grid-cols-3">
        <div className="border-b border-fd-border lg:border-r lg:border-b-0">
          <PanelHeader screenLines={false} className="border-b border-fd-border">
            <PanelTitle>
              <span className="flex h-7 items-center">
                <Skeleton className="h-4 w-52" />
              </span>
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            <Skeleton className="mb-4 h-4 w-full max-w-72" />
            <dl className="space-y-2">
              {Array.from({ length: rows }, (_, i) => (
                <div
                  key={i}
                  className="flex h-6 items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-5" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                  <Skeleton className="h-3.5 w-12" />
                </div>
              ))}
            </dl>
          </PanelContent>
        </div>
        <div className="lg:col-span-2">
          <PanelHeader screenLines={false} className="border-b border-fd-border">
            <PanelTitle>
              <span className="flex h-7 items-center">
                <Skeleton className="h-4 w-24" />
              </span>
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            <Skeleton className="h-56 w-full rounded-md" />
          </PanelContent>
        </div>
      </div>
    </Panel>
  );
}
