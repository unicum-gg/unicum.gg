import { MarkWindow, type MarkReachEntry } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { MOE_COLORS, MoEIcon } from "@/components/tanks/moe-icon";
import { VehicleRow } from "@/components/tanks/vehicle-row";
import ROUTES from "@/constants/routes";
import { MARK_CELL_CLASS } from "./colors";
import { cn } from "@/lib/utils";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * The vehicles whose numbers have outrun their gun.
 *
 * The lift/drag row from the panel above, since it answers the same shape of
 * question: which vehicles to go and do something about. The badge holds the
 * account's combined damage on that vehicle, coloured by the mark that figure
 * clears, and the line under it says what the gun actually carries.
 */
export function MarksReach({
  region,
  entries,
}: {
  region: Region;
  entries: MarkReachEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-fd-muted-foreground">
        No gun is behind what this account does with it.
      </div>
    );
  }

  return (
    <ul>
      {entries.map((e) => (
        <VehicleRow
          key={e.tankId}
          region={region}
          tag={e.tag}
          type={e.type}
          tier={e.tier}
          isPremium={e.isPremium}
          name={e.name}
          href={e.slug ? ROUTES.TANK(region, e.slug) : undefined}
          battles={e.battles}
          battlesNote={e.window === MarkWindow.Recent ? " (30d)" : undefined}
          badge={
            <span
              className={cn(
                "px-2 py-0.5 text-xs",
                MARK_CELL_CLASS[e.playingAt as 1 | 2 | 3],
              )}
              title={`${intFmt.format(e.combined)} combined damage, against ${intFmt.format(
                e.threshold,
              )} for that mark`}
            >
              {intFmt.format(e.combined)}
            </span>
          }
          caption={
            <span className="flex items-center gap-1 text-xs font-medium text-fd-muted-foreground">
              <span>carries</span>
              {e.marks > 0 ? (
                <MoEIcon
                  bars={e.marks as 1 | 2 | 3}
                  color={MOE_COLORS[e.marks as 1 | 2 | 3]}
                />
              ) : (
                "none"
              )}
            </span>
          }
        />
      ))}
    </ul>
  );
}
