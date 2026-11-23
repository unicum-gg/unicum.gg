"use client";

import type { Ref } from "react";
import { toRoman } from "roman-numerals";
import type { PlayerTankRow, TankBattleMode } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import Link from "@/components/link";
import ROUTES from "@/constants/routes";
import { useRouter } from "@/hooks/use-router";
import { withTankMode } from "@/hooks/use-tank-mode";
import { GarageState } from "@/hooks/use-tank-filters";
import { TableCell, TableRow } from "@/components/ui/table";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { GarageBadge } from "@/components/players/detail/tanks/garage-badge";
import type {
  PlayerCellCtx,
  PlayerColumn,
} from "@/components/players/detail/tanks/vehicle-columns";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

/**
 * A record path carrying the filters the table is showing.
 *
 * The filters live in the URL, written with `replaceState` as they change, so
 * nothing re-renders when they do and the href a row was rendered with carries
 * only the mode. Read at click time instead: the record opens beside the same
 * table, which seeds its filters from the URL on mount, so a reader who picked
 * tier XI and a nation does not land back on the whole garage. The mode is in
 * that query already whenever it is not the default.
 */
function withLiveQuery(href: string): string {
  const [path] = href.split("?");
  return `${path}${window.location.search}`;
}

/** One vehicle of the garage table, opening its record on click. */
export function PlayerTankTableRow({
  row: r,
  region,
  nickname,
  mode,
  selected,
  selectedRef,
  columns,
  cellCtx,
}: {
  row: PlayerTankRow & { garageState: GarageState | null };
  region: Region;
  nickname: string;
  /** The mode the row is read in, carried onto the record it opens. */
  mode: TankBattleMode;
  /** Whether this vehicle's record is the one open beside the table. */
  selected: boolean;
  selectedRef?: Ref<HTMLTableRowElement>;
  columns: PlayerColumn[];
  cellCtx: PlayerCellCtx;
}) {
  const router = useRouter();
  const hasIcon = !!(r.tag && r.type);
  const name = r.shortName || r.name || `#${r.tankId}`;
  const isPremium = r.isPremium;
  // A vehicle owned and never driven has no record to open: the record is
  // built from a per-tank snapshot, and Wargaming publishes none for a tank
  // that has never been in a battle, so that URL is a genuine 404 rather than a
  // page we forgot to write. The row still has somewhere to go, and it is the
  // vehicle's own page, which is the only one with anything to say about a tank
  // you own and have not played.
  const unplayed = r.garageState === GarageState.Unplayed;
  const href = !r.slug
    ? null
    : unplayed
      ? ROUTES.TANK(region, r.slug)
      : // In the mode the row is being read in, so a record opened from a
        // Skirmish list opens on Skirmish. The vehicle's own page above is not
        // a per-mode view, so it carries nothing.
        withTankMode(ROUTES.PLAYER_TANK(region, nickname, r.slug), mode);
  return (
    <TableRow
      ref={selectedRef}
      // The row opens this player's record on the tank, which is a URL of its
      // own. The name inside is a real link to the same place, so the
      // destination does not depend on where in the row the reader clicked.
      onClick={() => {
        if (!href) return;
        // `scroll: false` for the record, which opens beside the row: the
        // reader is picking a row half way down 157 of them, and jumping to
        // the top of the page would take both the row and the record they just
        // asked for off screen. An unplayed row leaves this page entirely, so
        // it keeps the normal scroll-to-top.
        router.push(
          unplayed ? href : withLiveQuery(href),
          unplayed ? undefined : { scroll: false },
        );
      }}
      className={cn(
        href && "cursor-pointer",
        // A left edge rather than a row tint: the rating columns paint their
        // own cells, so a background would show through on some columns and
        // not others.
        selected &&
          "bg-fd-secondary/40 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-brand",
      )}
    >
      <TableCell className={cn("text-center", styles.hiddenColumn)}>
        {r.nation ? (
          <NationFlag nation={r.nation} region={region} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={cn("text-center", styles.hiddenColumn)}>
        {r.type ? (
          <VehicleTypeIcon type={r.type} premium={isPremium} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell
        className={cn(
          "text-center font-medium",
          styles.hiddenColumn,
          isPremium && "text-[#FAB81B]",
        )}
      >
        {r.tier ? toRoman(r.tier) : "—"}
      </TableCell>
      <TableCell
        className={cn(
          // Never wrapped: a name folding onto three lines is what makes a
          // narrowed table look broken, and the container scrolls when it has
          // to.
          "font-medium whitespace-nowrap max-sm:pl-4!",
          isPremium && "text-[#FAB81B]",
        )}
      >
        <span className="flex items-center gap-2">
          {hasIcon ? (
            <TankIcon
              region={region}
              tag={r.tag!}
              type={r.type!}
              className="h-3.5 w-auto shrink-0 object-contain"
            />
          ) : null}
          {href ? (
            <Link
              // Same destination as the row around it, whichever of the two it
              // is. Sending the name somewhere else made one row answer two
              // ways depending on where it was clicked, which reads as a broken
              // link rather than as a second destination.
              href={href}
              scroll={unplayed ? undefined : false}
              // The row's own handler navigates with the live filters; letting
              // the link navigate too would race it with the bare href.
              onClick={(e) => {
                if (unplayed || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
                  e.stopPropagation();
                  return;
                }
                e.preventDefault();
              }}
              className="hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span>{name}</span>
          )}
          <GarageBadge state={r.garageState} />
        </span>
      </TableCell>
      {columns.map((c) => {
        const { node, className } = c.cell(r, cellCtx);
        return (
          <TableCell
            key={c.key}
            className={cn(
              "tabular-nums",
              c.align === "center" && "text-center",
              c.align === "end" && "text-right",
              c.hideOnMobile && styles.hiddenColumn,
              className,
            )}
          >
            {node}
          </TableCell>
        );
      })}
    </TableRow>
  );
}
