import Link from "next/link";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/players/nation-flag";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import { styles } from "@/lib/styles";
import type { TankCommunityStats } from "@/services/tanks/aggregates";
import { nationLabel, typeLabel } from "@/services/tanks/labels";
import type { VehicleMeta } from "@/services/wargaming/wot/encyclopedia";
import {
  RATING_COLOR_CLASS,
  winrateColor,
} from "@/services/wargaming/wot/ratings";
import { Region, REGION_LABEL } from "@/services/wargaming/wot";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const decFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export type SimilarTank = { tankId: number; meta: VehicleMeta };

function StatCell({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="text-xs uppercase tracking-wide text-fd-muted-foreground">
        {label}
      </span>
      <span className={cn("text-lg font-semibold tabular-nums", className)}>
        {value}
      </span>
    </div>
  );
}

export function TankDetailView({
  region,
  meta,
  stats,
  similar,
}: {
  region: Region;
  meta: VehicleMeta;
  stats: TankCommunityStats | null;
  similar: SimilarTank[];
}) {
  const label = REGION_LABEL[region];
  const tier = toRoman(meta.tier);
  const klass = typeLabel(meta.type);
  const nation = nationLabel(meta.nation);
  const wr = stats?.avgWinrate ?? null;

  const premiumNote = meta.isPremium
    ? "It is a premium vehicle, so its crew trains faster and its credit income is higher than a comparable tech-tree tank."
    : "It is a regular tech-tree vehicle.";

  const statsNote =
    stats && stats.players > 0
      ? `Across the ${intFmt.format(stats.players)} ${label} players we track on it, the ${meta.name} averages a ${pctFmt.format((wr ?? 0) * 100)}% win rate and ${intFmt.format(stats.avgDamage ?? 0)} damage per battle over ${intFmt.format(stats.battles)} recorded battles.`
      : `We do not have enough tracked battles on the ${meta.name} ${label} yet to publish reliable community averages. Check back as more players are crawled.`;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Panel>
        <PanelContent className="p-0">
          <nav
            aria-label="Breadcrumb"
            className={`px-4 pt-4 text-sm ${styles.mutedText}`}
          >
            <Link href={ROUTES.TANKS(region)} className={styles.linkHover}>
              Tanks ({label})
            </Link>
            <span className="px-2">/</span>
            <span>{meta.name}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3 px-4 py-6">
            <NationFlag nation={meta.nation} className="h-6 w-auto" />
            <h1
              className={cn(
                "font-heading text-3xl font-bold tracking-tight md:text-4xl",
                meta.isPremium && "text-[#FAB81B]",
              )}
            >
              {meta.name}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 px-4 pb-6 text-sm text-fd-muted-foreground">
            <span className="rounded-md border border-fd-border px-2 py-1">
              Tier {tier}
            </span>
            <span className="rounded-md border border-fd-border px-2 py-1">
              {klass}
            </span>
            <span className="rounded-md border border-fd-border px-2 py-1">
              {nation}
            </span>
            {meta.isPremium ? (
              <span className="rounded-md border border-[#FAB81B] px-2 py-1 text-[#FAB81B]">
                Premium
              </span>
            ) : null}
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{meta.name} community stats ({label})</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="grid grid-cols-2 divide-x divide-y divide-fd-border sm:grid-cols-3 lg:grid-cols-5">
            <StatCell
              label="Players"
              value={stats ? intFmt.format(stats.players) : "—"}
            />
            <StatCell
              label="Win rate"
              value={wr !== null ? `${pctFmt.format(wr * 100)}%` : "—"}
              className={
                wr !== null ? RATING_COLOR_CLASS[winrateColor(wr)] : undefined
              }
            />
            <StatCell
              label="Avg damage"
              value={
                stats?.avgDamage != null
                  ? intFmt.format(stats.avgDamage)
                  : "—"
              }
            />
            <StatCell
              label="Avg frags"
              value={
                stats?.avgFrags != null ? decFmt.format(stats.avgFrags) : "—"
              }
            />
            <StatCell
              label="Battles"
              value={stats ? intFmt.format(stats.battles) : "—"}
            />
          </div>
          {stats ? (
            <div className={`px-4 py-3 ${styles.mutedDescription}`}>
              Community averages as of {dateFmt.format(stats.computedAt)}.
              Win rate color follows the standard WoT performance tiers.
            </div>
          ) : null}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>About the {meta.name}</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <p className="text-fd-muted-foreground">
            The {meta.name} is a Tier {tier} {nation} {klass.toLowerCase()} in
            World of Tanks. {premiumNote} {statsNote}
          </p>
          <p className={`mt-3 ${styles.mutedDescription}`}>
            Looking for a specific player&apos;s performance on this vehicle?
            Open any{" "}
            <Link href={ROUTES.PLAYERS(region)} className={styles.linkHover}>
              {label} player profile
            </Link>{" "}
            to see their full tank-by-tank breakdown, or browse the{" "}
            <Link href={ROUTES.TANKS(region)} className={styles.linkHover}>
              full {label} vehicle list
            </Link>
            .
          </p>
        </PanelContent>
      </Panel>

      {similar.length > 0 ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>
                Similar tanks (Tier {tier} {klass.toLowerCase()}s)
              </PanelTitle>
            </PanelHeader>
            <PanelContent>
              <div className="flex flex-wrap gap-2">
                {similar.map((t) => (
                  <Link
                    key={t.tankId}
                    href={ROUTES.TANK(region, t.tankId)}
                    className={cn(
                      "rounded-md border border-fd-border px-3 py-1.5 text-sm transition-colors hover:bg-fd-accent",
                      t.meta.isPremium && "text-[#FAB81B]",
                    )}
                  >
                    {t.meta.name}
                  </Link>
                ))}
              </div>
            </PanelContent>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
