"use client";

import { useMemo } from "react";
import Link from "next/link";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankIcon } from "@/components/tanks/tank-icon";
import {
  formatSpecChange,
  type FormattedChange,
} from "@/components/tanks/change-format";
import { ChangeRow } from "@/components/tanks/change-row";
import {
  TankDetailTab,
  tankDetailTabHref,
} from "@/components/tanks/detail/tabs";
import { Panel, PanelContent } from "@/components/panel";
import { TablePager, usePagination } from "@/components/table-pager";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";

type SpecChange = { field: string; previous: number | null; next: number | null };
type FeedTank = {
  identity: {
    tankId: number;
    slug: string;
    name: string;
    shortName: string;
    tier: number;
    nation: string;
    type: string;
    tag: string;
  };
  changes: SpecChange[];
};
export type FeedVersion = {
  gameVersion: string;
  capturedAt: string | Date;
  tanks: FeedTank[];
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/**
 * The global tank-changes feed: every rebalanced tank, grouped by game version
 * (newest first) then by tank (heaviest-hit first). Each tank's changes are
 * stacked one per line under it (buffs green, nerfs red), the same way the
 * per-tank History tab reads. Paginated over the flat tank list (a big patch can
 * touch dozens of tanks), with the version header repeated at the top of each
 * page for context.
 */
export function TankChangesFeed({
  region,
  versions,
}: {
  region: Region;
  versions: FeedVersion[];
}) {
  // One entry per (version, tank); paginate the flat list so a huge patch does
  // not render hundreds of tanks at once.
  const entries = useMemo(
    () =>
      versions.flatMap((version) =>
        version.tanks.map((tank) => ({ version, tank })),
      ),
    [versions],
  );
  const { paged, pager } = usePagination(entries, 25);

  if (entries.length === 0) {
    return (
      <Panel>
        <PanelContent className="px-4 py-12 text-center text-sm text-fd-muted-foreground">
          No tank changes have been recorded yet. As Wargaming rebalances tanks,
          the buffs and nerfs of each update will appear here.
        </PanelContent>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelContent className="p-0">
        <div className="divide-y divide-fd-border">
          {paged.map((entry, i) => {
            const prev = i > 0 ? paged[i - 1] : null;
            const newVersion =
              !prev || prev.version.gameVersion !== entry.version.gameVersion;
            return (
              <div key={`${entry.version.gameVersion}:${entry.tank.identity.tankId}`}>
                {newVersion ? <VersionHeader version={entry.version} /> : null}
                <TankBlock region={region} tank={entry.tank} />
              </div>
            );
          })}
        </div>
      </PanelContent>
      <TablePager pager={pager} />
    </Panel>
  );
}

function VersionHeader({ version }: { version: FeedVersion }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-fd-border bg-fd-secondary/20 px-4 py-2.5">
      <h2 className="font-heading text-sm font-semibold">
        Update {version.gameVersion}
        <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
          {dateFmt.format(new Date(version.capturedAt))}
        </span>
      </h2>
      <span className="text-xs text-fd-muted-foreground tabular-nums">
        {version.tanks.length} tank{version.tanks.length === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function TankBlock({ region, tank }: { region: Region; tank: FeedTank }) {
  const { identity } = tank;
  const changes = tank.changes
    .map((c) => formatSpecChange(c.field, c.previous, c.next))
    .filter((c): c is FormattedChange => c !== null);
  if (changes.length === 0) return null;
  const buffs = changes.filter((c) => c.isBuff === true).length;
  const nerfs = changes.filter((c) => c.isBuff === false).length;
  const tierLabel = identity.tier ? toRoman(identity.tier) : String(identity.tier);

  return (
    <div className="flex flex-col sm:flex-row">
      <Link
        href={tankDetailTabHref(
          ROUTES.TANK(region, identity.slug),
          TankDetailTab.History,
        )}
        className="group flex shrink-0 items-start gap-2 px-4 py-3 sm:w-52"
      >
        <TankIcon
          region={region}
          tag={identity.tag}
          type={identity.type}
          className="h-auto w-8 shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-fd-muted-foreground">
            <span className="font-semibold text-brand">{tierLabel}</span>
            <NationFlag nation={identity.nation} region={region} variant="flag" />
          </div>
          <div className="truncate text-sm font-medium group-hover:text-brand">
            {identity.shortName || identity.name}
          </div>
          <div className="mt-0.5 flex gap-2 text-xs tabular-nums">
            {buffs > 0 ? (
              <span className="text-emerald-500">{buffs} buffed</span>
            ) : null}
            {nerfs > 0 ? (
              <span className="text-red-500">{nerfs} nerfed</span>
            ) : null}
          </div>
        </div>
      </Link>
      <ul className="flex-1 divide-y divide-fd-border sm:border-l sm:border-fd-border">
        {changes.map((change) => (
          <ChangeRow key={change.field} change={change} className="px-4" />
        ))}
      </ul>
    </div>
  );
}
