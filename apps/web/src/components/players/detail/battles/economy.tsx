"use client";

import useSWR from "swr";
import { useLocale } from "@onruntime/translations/react";
import { toRoman } from "roman-numerals";
import {
  economyModeKey,
  PLAYER_MODE_ECONOMY_MIN_BATTLES,
  type PlayerModeEconomy,
  type PlayerModeEconomyRow,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { economyModeName } from "@/components/game-name";
import { SegmentedControl } from "@/components/segmented-control";
import { Spinner } from "@/components/ui/spinner";
import { useTierParam } from "@/hooks/use-tier-param";
import { useTranslation } from "@/hooks/use-translation";
import { numberFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { unicum } from "@/services/sdk";

const INT = { maximumFractionDigits: 0 } as const;
const SIGNED = { maximumFractionDigits: 0, signDisplay: "exceptZero" } as const;

/** Seconds as m:ss, the game's own way of writing a battle's length. */
function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function tierLabel(tier: number): string {
  return tier > 0 ? toRoman(tier) : String(tier);
}

/** Whether a row holds enough battles for its figures to be read as more than
 * an anecdote. Thinner rows stay, faded, rather than vanish: a mode played
 * twice is still a mode the player asked about. */
const readable = (row: PlayerModeEconomyRow) =>
  row.battles >= PLAYER_MODE_ECONOMY_MIN_BATTLES;

/** The tier the panel opens on: the one the player fought the most battles
 * at, which is the one they are most likely asking about. */
function defaultTier(rows: PlayerModeEconomyRow[]): number {
  if (rows.length === 0) return 0;
  const battles = new Map<number, number>();
  for (const row of rows) battles.set(row.tier, (battles.get(row.tier) ?? 0) + row.battles);
  let best = rows[0]!.tier;
  for (const [tier, count] of battles) {
    const held = battles.get(best)!;
    if (count > held || (count === held && tier > best)) best = tier;
  }
  return best;
}

/**
 * What each mode paid this player, one tier at a time: the region-wide panel on
 * the servers page answered for everybody, and could not say "net" until
 * several mod players stood behind a row. Here one is the whole point, since
 * the question is "which mode pays ME", premium account and gold shells
 * included.
 *
 * A tier switch rather than every tier stacked, because modes are only
 * comparable within a tier and a player of eleven tiers would otherwise get a
 * table of forty rows; this way it is never more than one row per mode.
 *
 * Read from the battles the player uploaded themselves, the only ones carrying
 * their wallet, so the panel only exists for the mod's own players and is
 * absent rather than empty for everybody else.
 */
export function BattleEconomy({
  region,
  nickname,
  initial,
  ownPrivate,
}: {
  region: Region;
  nickname: string;
  /** Server-rendered with the tab, so the panel is there on arrival. */
  initial: PlayerModeEconomy | null;
  /** The reader is this player and keeps their battles private, so what the
   * page was rendered with is the visitor's answer and theirs is on its way. */
  ownPrivate: boolean;
}) {
  const { t } = useTranslation("components/players/detail/battles/economy");
  const { locale } = useLocale();

  const request = () => unicum.region(region).players(nickname).battlesEconomy();
  const { data, isValidating } = useSWR(
    request().url(),
    () => request().then((r) => r as unknown as PlayerModeEconomy),
    { fallbackData: initial ?? undefined, revalidateOnFocus: false },
  );
  const all = data?.rows ?? [];
  const tiers = [...new Set(all.map((row) => row.tier))].sort((a, b) => b - a);
  const [tier, setTier] = useTierParam(tiers, defaultTier(all));
  // The page is cached for everybody, so a private list arrives with the
  // visitor's refusal and the owner's own answer only after it. The panel
  // keeps its place meanwhile, as the list above it does, rather than
  // appearing from nothing and pushing everything under it down.
  if (ownPrivate && (!data || data.hidden) && all.length === 0 && isValidating) {
    return (
      <>
        <PanelSeparator />
        <Panel>
          <PanelHeader>
            <PanelTitle>{t("title", { nickname })}</PanelTitle>
          </PanelHeader>
          <PanelContent className="flex min-h-72 items-center justify-center">
            <Spinner />
          </PanelContent>
        </Panel>
      </>
    );
  }
  if (!data || all.length === 0) return null;

  const int = numberFormat(locale, INT);
  // Event vehicles have no tier, so their tab is named for what they are.
  const tierName = (each: number) =>
    each === 0 ? t("event-vehicles") : t("tier", { tier: tierLabel(each) });
  const battles = data.rows.reduce((sum, row) => sum + row.battles, 0);

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-2">
          <PanelTitle>{t("title", { nickname })}</PanelTitle>
          {tiers.length > 1 ? (
            <SegmentedControl
              active={String(tier)}
              onSelect={(next) => setTier(Number(next))}
              segments={tiers.map((each) => ({
                id: String(each),
                label: tierName(each),
              }))}
            />
          ) : null}
        </PanelHeader>
        <PanelContent className="p-0">
          {/* Every tier is in the HTML and the switch only hides the others,
              so the figures are there for whatever reads the page without
              running it, whichever tier the URL names. */}
          {tiers.map((each) => (
            <TierTable
              key={each}
              rows={all.filter((row) => row.tier === each)}
              heading={
                tiers.length > 1 || each === 0
                  ? t("mode")
                  : t("mode-at-tier", { tier: tierLabel(each) })
              }
              caption={tierName(each)}
              hidden={each !== tier}
            />
          ))}
          <p className="text-fd-muted-foreground p-4 text-sm">
            {t("explanation", {
              days: data.windowDays,
              battles: int.format(battles),
            })}
          </p>
        </PanelContent>
      </Panel>
    </>
  );
}

/** A signed credit figure, green when it paid and red when it cost. */
function Profit({
  value,
  format,
  className,
}: {
  value: number;
  format: Intl.NumberFormat;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 text-right font-medium tabular-nums",
        value < 0 ? "text-red-500" : "text-emerald-500",
        className,
      )}
    >
      {format.format(value)}
    </td>
  );
}

/** One tier's modes, ranked on profit per minute of battle. */
function TierTable({
  rows: unsorted,
  heading,
  caption,
  hidden,
}: {
  rows: PlayerModeEconomyRow[];
  heading: string;
  /** The tier, named for whatever reads the table without the switch. */
  caption: string;
  hidden: boolean;
}) {
  const { t } = useTranslation("components/players/detail/battles/economy");
  const { t: tGame } = useTranslation("game/vocabulary");
  const { locale } = useLocale();
  const int = numberFormat(locale, INT);
  const signed = numberFormat(locale, SIGNED);
  const rows = [...unsorted].sort((a, b) => b.netPerMinute - a.netPerMinute);
  // The best mode is marked only when there is another readable one to beat.
  const contenders = rows.filter(readable);
  const best = contenders.length > 1 ? contenders[0] : null;
  const head = "px-3 py-2 text-right font-normal whitespace-nowrap";
  const cell = "px-3 py-2.5 text-right tabular-nums";
  // Through the same formatter as the profits, so both write their minus sign alike.
  const bill = (value: number) => signed.format(-value);
  return (
    <div className="overflow-x-auto" hidden={hidden}>
      <table className="w-full min-w-[56rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-fd-border text-fd-muted-foreground border-b text-xs">
            <th className="px-4 py-2 text-left font-normal">{heading}</th>
            <th className={head}>{t("battles")}</th>
            <th className={head}>{t("earned")}</th>
            <th className={head}>{t("repair")}</th>
            <th className={head}>{t("ammo")}</th>
            <th className={head}>{t("supplies")}</th>
            <th className={head}>{t("net")}</th>
            <th className={head}>{t("duration")}</th>
            <th className={head}>{t("net-per-minute")}</th>
            <th className={head}>{t("lifetime")}</th>
            <th className={cn(head, "pr-4")}>{t("net-per-minute-alive")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.battleType}
              className={cn(
                "border-fd-border border-b last:border-b-0",
                !readable(row) && "opacity-50",
              )}
              title={
                readable(row)
                  ? undefined
                  : t("thin", { min: PLAYER_MODE_ECONOMY_MIN_BATTLES })
              }
            >
              <td
                className={cn(
                  "px-4 py-2.5 font-medium whitespace-nowrap",
                  row === best && "text-brand",
                )}
              >
                {economyModeName(economyModeKey(row.battleType), tGame)}
              </td>
              <td className={cell}>{int.format(row.battles)}</td>
              <td className={cell}>{int.format(row.grossPerBattle)}</td>
              <td className={cn(cell, "text-fd-muted-foreground")}>
                {bill(row.repairPerBattle)}
              </td>
              <td className={cn(cell, "text-fd-muted-foreground")}>
                {bill(row.ammoPerBattle)}
              </td>
              <td className={cn(cell, "text-fd-muted-foreground")}>
                {bill(row.suppliesPerBattle)}
              </td>
              <Profit value={row.netPerBattle} format={signed} />
              <td className={cn(cell, "text-fd-muted-foreground")}>
                {clock(row.avgDuration)}
              </td>
              <Profit value={row.netPerMinute} format={signed} />
              <td className={cn(cell, "text-fd-muted-foreground")}>
                {clock(row.avgLifetime)}
              </td>
              <Profit value={row.netPerMinuteAlive} format={signed} className="pr-4" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
