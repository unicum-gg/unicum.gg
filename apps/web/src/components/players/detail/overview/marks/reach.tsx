import { numberFormat } from "@/lib/format";
import { Interpolate } from "@/components/interpolate";
import { MarkWindow, type MarkReachEntry } from "@unicum.gg/shared";
import { useTranslation } from "@/hooks/use-translation";
import type { Region } from "@unicum.gg/wargaming";
import { MOE_COLORS, MoEIcon } from "@/components/tanks/moe-icon";
import { VehicleRow } from "@/components/tanks/vehicle-row";
import ROUTES from "@/constants/routes";
import { MARK_CELL_CLASS } from "./colors";
import { cn } from "@/lib/utils";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

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
  locale,
}: {
  region: Region;
  entries: MarkReachEntry[];
  locale: string;
}) {
  const { t } = useTranslation(
    "components/players/detail/overview/marks/reach",
  );
  if (entries.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-fd-muted-foreground">
        {t("empty")}
      </div>
    );
  }

  return (
    <ul>
      {entries.map((e) => (
        <VehicleRow
          locale={locale}
          key={e.tankId}
          region={region}
          tag={e.tag}
          type={e.type}
          tier={e.tier}
          isPremium={e.isPremium}
          name={e.name}
          href={e.slug ? ROUTES.TANK(region, e.slug) : undefined}
          battles={e.battles}
          battlesNote={
            e.window === MarkWindow.Recent ? ` ${t("recent-window")}` : undefined
          }
          badge={
            <span
              className={cn(
                "px-2 py-0.5 text-xs",
                MARK_CELL_CLASS[e.playingAt as 1 | 2 | 3],
              )}
              title={t("badge-title", {
                combined: numberFormat(locale, INT_FORMAT).format(e.combined),
                threshold: numberFormat(locale, INT_FORMAT).format(e.threshold),
              })}
            >
              {numberFormat(locale, INT_FORMAT).format(e.combined)}
            </span>
          }
          caption={
            <span className="flex items-center gap-1 text-xs font-medium text-fd-muted-foreground">
              {/* One clause with the mark as a hole, not a bare "carries" beside
                  an icon: alone the verb has no subject, and it came back as
                  "transport" in Czech, "load" in Spanish and "carriers" in
                  Ukrainian. A language also puts the mark somewhere English
                  would not. */}
              <Interpolate
                template={t("gun-carries")}
                values={{
                  marks:
                    e.marks > 0 ? (
                      <MoEIcon
                        bars={e.marks as 1 | 2 | 3}
                        color={MOE_COLORS[e.marks as 1 | 2 | 3]}
                      />
                    ) : (
                      t("none")
                    ),
                }}
              />
            </span>
          }
        />
      ))}
    </ul>
  );
}
