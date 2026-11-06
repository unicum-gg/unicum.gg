"use client";

import { useLocale } from "@onruntime/translations/react";
import { useMemo } from "react";
import { toRoman } from "roman-numerals";
import {
  MODE_ECONOMY_MIN_NET_PLAYERS,
  type ModeEconomy,
  type ModeEconomyRow,
} from "@unicum.gg/shared";
import { REGION_LABEL, type Region } from "@unicum.gg/wargaming";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { SegmentedControl } from "@/components/segmented-control";
import { LOADOUT_MODE_NAME_KEY } from "@/components/tanks/detail/loadouts/mode-names";
import { useTierParam } from "@/hooks/use-tier-param";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { formatPlayers, formatPlayersCompact } from "./format";

/**
 * Which battle mode pays best, one tier at a time.
 *
 * A table rather than a chart: four modes and six figures each, read across a
 * row, and the one comparison everyone comes for (credits per minute) carries a
 * bar inside its own cell so it still reads at a glance. Rows are ranked on it,
 * since a player farming credits is buying time, and per battle a short mode
 * looks poorer than it is.
 *
 * The tier is a switch rather than a column because a vehicle earns by its
 * tier and the modes do not share one: compared across tiers, Onslaught would
 * win only because nobody plays it at tier V.
 */

/** `toRoman` answers "nulla" for 0 and throws below it. */
function tierLabel(tier: number): string {
  return tier > 0 ? toRoman(tier) : String(tier);
}

/** The tier the panel opens on: the one most modes are measured at, the
 * highest on a tie, since that is where the comparison is the fullest. */
function defaultTier(rows: ModeEconomyRow[]): number | null {
  const modes = new Map<number, number>();
  for (const row of rows) modes.set(row.tier, (modes.get(row.tier) ?? 0) + 1);
  let best: number | null = null;
  for (const [tier, count] of modes) {
    if (best === null || count > modes.get(best)! || (count === modes.get(best)! && tier > best)) {
      best = tier;
    }
  }
  return best;
}

function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function ModeEconomyPanel({
  economy,
  region,
}: {
  economy: ModeEconomy;
  region: Region;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/servers/mode-economy");

  const tiers = useMemo(
    () => [...new Set(economy.rows.map((row) => row.tier))].sort((a, b) => b - a),
    [economy.rows],
  );
  const [tier, setTier] = useTierParam(tiers, defaultTier(economy.rows) ?? 0);
  const showNet = economy.rows.some((row) => row.tier === tier && netReadable(row));
  const label = REGION_LABEL[region];

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-2">
        <PanelTitle>{t("title", { label })}</PanelTitle>
        <SegmentedControl
          active={String(tier)}
          onSelect={(next) => setTier(Number(next))}
          segments={tiers.map((each) => ({
            id: String(each),
            label: t("tier", { tier: tierLabel(each) }),
          }))}
        />
      </PanelHeader>
      <PanelContent className="p-0">
        {/* Every tier is in the HTML and the switch only hides the others,
            so the figures are there for whatever reads the page without
            running it, whichever tier the URL names. */}
        {tiers.map((each) => (
          <TierTable
            key={each}
            rows={economy.rows.filter((row) => row.tier === each)}
            caption={t("tier", { tier: tierLabel(each) })}
            hidden={each !== tier}
          />
        ))}

        <div className="space-y-2 border-t border-fd-border p-4 text-sm text-fd-muted-foreground">
          <p>
            {t("explanation", {
              days: economy.windowDays,
              records: formatPlayersCompact(
                economy.rows.reduce((sum, row) => sum + row.records, 0),
                locale,
              ),
            })}
          </p>
          <p>
            {showNet
              ? t("net-explanation", { min: MODE_ECONOMY_MIN_NET_PLAYERS })
              : t("net-pending", { min: MODE_ECONOMY_MIN_NET_PLAYERS })}
          </p>
        </div>
      </PanelContent>
    </Panel>
  );
}

/** The net is only read where enough mod players stand behind it, and its
 * column only drawn when at least one row of the tier qualifies: a column of
 * blanks would read as "these modes cost nothing". */
const netReadable = (row: ModeEconomyRow) =>
  row.netPerBattle !== null && row.netPlayers >= MODE_ECONOMY_MIN_NET_PLAYERS;

/** One tier's modes, ranked on credits per minute. */
function TierTable({
  rows: unsorted,
  caption,
  hidden,
}: {
  rows: ModeEconomyRow[];
  /** The tier, named for whatever reads the table without the switch. */
  caption: string;
  hidden: boolean;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/servers/mode-economy");
  const { t: tGame } = useTranslation("game/vocabulary");
  const rows = [...unsorted].sort((a, b) => b.creditsPerMinute - a.creditsPerMinute);
  const topPerMinute = rows[0]?.creditsPerMinute ?? 0;
  const showNet = rows.some(netReadable);
  const credits = (value: number) => formatPlayers(value, locale);
  return (
        <div className="overflow-x-auto" hidden={hidden}>
          <table className="w-full min-w-[52rem] text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-fd-border text-xs text-fd-muted-foreground">
                <th className="px-4 py-2 text-left font-normal">{t("mode")}</th>
                <th className="px-4 py-2 text-right font-normal">{t("battles")}</th>
                <th className="px-4 py-2 text-right font-normal">{t("players")}</th>
                <th className="px-4 py-2 text-right font-normal">{t("credits-per-minute")}</th>
                <th className="px-4 py-2 text-right font-normal">{t("credits-per-battle")}</th>
                <th className="px-4 py-2 text-right font-normal">{t("xp-per-minute")}</th>
                <th className="px-4 py-2 text-right font-normal">{t("xp-per-battle")}</th>
                <th className="px-4 py-2 text-right font-normal">{t("battle-length")}</th>
                {showNet ? (
                  <th className="px-4 py-2 text-right font-normal">{t("net-per-battle")}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.mode} className="border-b border-fd-border last:border-b-0">
                  <td
                    className={cn(
                      "px-4 py-2.5 font-medium whitespace-nowrap",
                      index === 0 && "text-brand",
                    )}
                  >
                    {tGame(LOADOUT_MODE_NAME_KEY[row.mode])}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatPlayers(row.battles, locale)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatPlayers(row.players, locale)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-fd-secondary sm:block">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{
                            width: `${topPerMinute > 0 ? (row.creditsPerMinute / topPerMinute) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="font-medium">{credits(row.creditsPerMinute)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {credits(row.creditsPerBattle)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {credits(row.xpPerMinute)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {credits(row.xpPerBattle)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {clock(row.avgDuration)}
                  </td>
                  {showNet ? (
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {netReadable(row) ? (
                        <span
                          className={cn(
                            row.netPerBattle! < 0 ? "text-red-500" : "text-emerald-500",
                          )}
                          title={t("net-sample", {
                            players: formatPlayers(row.netPlayers, locale),
                            battles: formatPlayers(row.netRecords, locale),
                          })}
                        >
                          {credits(row.netPerBattle!)}
                        </span>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
  );
}
