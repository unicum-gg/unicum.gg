import Image from "next/image";
import {
  CONFIDENT_SPAWN_SAMPLE,
  type MapStatistics,
} from "@unicum.gg/shared";
import { BASE } from "@/components/maps/detail/minimap-overlay";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { numberFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";

/**
 * How a battle on this map goes, counted per BATTLE: how long it lasts, how it
 * ends and which side wins.
 *
 * The three figures a player asks of a map before any of the per-vehicle ones,
 * and the three that need the most battles to mean anything, since each battle
 * gives one answer rather than thirty. So the spawn split reads as a count
 * ("4 of 9") until `CONFIDENT_SPAWN_SAMPLE`, where a coin would land that far
 * from even often enough that a percentage would be claiming a bias it has not
 * shown.
 *
 * The teams wear the minimap's own base flags, green for team 1 and red for
 * team 2, so this reads straight against the map drawn above it.
 */
export async function MapOverview({
  stats,
  title,
  locale,
}: {
  stats: Pick<MapStatistics, "battles" | "avgDuration" | "finish" | "spawns">;
  /** Names the map and the mode, resolved by the tab. */
  title: string;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/maps/detail/statistics/overview",
    locale,
  );
  const integer = numberFormat(locale, { maximumFractionDigits: 0 });
  const percent = numberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });

  const decided = stats.spawns.team1 + stats.spawns.team2 + stats.spawns.draws;
  const confident = decided >= CONFIDENT_SPAWN_SAMPLE;
  const share = (count: number) =>
    confident
      ? percent.format(decided > 0 ? count / decided : 0)
      : t("count-of", {
          count: integer.format(count),
          total: integer.format(decided),
        });

  const duration =
    stats.avgDuration == null
      ? null
      : `${Math.floor(stats.avgDuration / 60)}:${String(
          Math.round(stats.avgDuration % 60),
        ).padStart(2, "0")}`;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
      </PanelHeader>
      <PanelContent className="grid gap-6 sm:grid-cols-3">
        <section className="space-y-1">
          <h3 className="text-sm text-fd-muted-foreground">{t("duration")}</h3>
          <p className="text-2xl font-semibold tabular-nums">
            {duration ?? "—"}
          </p>
          <p className="text-xs text-fd-muted-foreground">{t("duration-hint")}</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm text-fd-muted-foreground">{t("ending")}</h3>
          <ul className="space-y-1.5">
            {stats.finish.map((entry) => (
              <li key={entry.reason} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>{t(`finish.${entry.reason}`)}</span>
                  <span className="tabular-nums text-fd-muted-foreground">
                    {integer.format(entry.battles)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-fd-muted">
                  <div
                    className="h-full rounded-full bg-fd-primary"
                    style={{
                      width: `${(100 * entry.battles) / Math.max(1, stats.battles)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm text-fd-muted-foreground">{t("spawns")}</h3>
          <ul className="space-y-1.5 text-sm">
            {([1, 2] as const).map((team) => (
              <li key={team} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Image
                    src={team === 1 ? BASE.team1 : BASE.team2}
                    alt=""
                    width={20}
                    height={20}
                  />
                  {t("team", { n: team })}
                </span>
                <span className="font-medium tabular-nums">
                  {share(team === 1 ? stats.spawns.team1 : stats.spawns.team2)}
                </span>
              </li>
            ))}
            {stats.spawns.draws > 0 ? (
              <li className="flex items-center justify-between gap-2 text-fd-muted-foreground">
                <span>{t("draws")}</span>
                <span className="tabular-nums">{share(stats.spawns.draws)}</span>
              </li>
            ) : null}
          </ul>
          <p className="text-xs text-fd-muted-foreground">
            {confident ? t("spawns-hint") : t("spawns-small")}
          </p>
        </section>
      </PanelContent>
    </Panel>
  );
}
