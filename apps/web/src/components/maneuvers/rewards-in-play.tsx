"use client";

import { CheckCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import {
  inTopShare,
  ManeuversBadge,
  maneuversBadgeIconUrl,
  ManeuversMedal,
  maneuversMedal,
  maneuversMultiplier,
  maneuversPlayerRewards,
  MANEUVERS_CLAN_BATTLES,
  MANEUVERS_HERO_SHARE,
  MANEUVERS_LEGEND_BATTLE_SHARE,
  MANEUVERS_LEGEND_SHARE,
  topShareLastPlace,
} from "@unicum.gg/shared";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const PCT_FORMAT = { style: "percent", maximumFractionDigits: 0 } as const;

/** One reward line: a tick or a cross, what it is, and the figure or the
 * reason beside it. */
function Line({
  ok,
  label,
  detail,
  badge,
}: {
  ok: boolean;
  label: string;
  detail?: string;
  /** Drawn in place of the tick: the badge's own art, greyed when out of
   * reach, which says more than a cross. */
  badge?: ManeuversBadge;
}) {
  const Icon = ok ? CheckCircleIcon : XCircleIcon;
  return (
    <li className="flex items-start gap-2 text-sm">
      {badge ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={maneuversBadgeIconUrl(badge, 24)}
          alt=""
          width={16}
          height={16}
          className={cn("mt-0.5 size-4 shrink-0", !ok && "opacity-40 grayscale")}
        />
      ) : (
        <Icon
          weight="fill"
          aria-hidden
          className={cn(
            "mt-0.5 size-4 shrink-0",
            ok ? "text-emerald-500" : "text-fd-muted-foreground/60",
          )}
        />
      )}
      <span>
        <span className={cn(ok ? "text-fd-foreground" : "text-fd-muted-foreground")}>
          {label}
        </span>
        {detail ? <span className="text-fd-muted-foreground"> · {detail}</span> : null}
      </span>
    </li>
  );
}

/** The event's own name and the medal names composed from it, so a language
 * that renames Maneuvers renames these with it. */
function useNames() {
  const { t } = useTranslation("components/maneuvers/rewards-in-play");
  const { t: tGame } = useTranslation("game/vocabulary");
  const maneuvers = tGame("battle-formats.maneuvers");
  return {
    t,
    maneuvers,
    medal: (medal: ManeuversMedal) => t(`medals.${medal}`, { maneuvers }),
  };
}

/**
 * What a player's standing is worth right now, by the event's regulations:
 * the vehicle, their bonds and their clan's multiplier on them, and the badges
 * and medal they are in position for. "In position" because each of those
 * also asks for battles played for the clan, which no board publishes, and the
 * footnote says so.
 */
export function ManeuversPlayerRewards({
  current,
}: {
  current: {
    place: number;
    ranked: number | null;
    rewardPositions: number | null;
    accountBondsPercent: number | null;
    clanPlace: number | null;
    clansRanked: number | null;
    clanBondsPercent: number | null;
  };
}) {
  const { t, maneuvers, medal } = useNames();
  const { num } = useFormat();
  const fmt = num(INT_FORMAT);
  const pct = num(PCT_FORMAT);
  if (!current.ranked) return null;
  const ranked = current.ranked;
  // What stands between the player and a badge, said in places: their own
  // place against the last one inside the share, then their clan's, each only
  // when it is the condition missing.
  const playerGap = (share: number) =>
    inTopShare(current.place, ranked, share)
      ? null
      : t("players-short", {
          share: pct.format(share),
          last: fmt.format(topShareLastPlace(ranked, share)),
          place: fmt.format(current.place),
        });
  const clanGap = (share: number) =>
    current.clanPlace == null || !current.clansRanked
      ? t("no-clan", { share: pct.format(share) })
      : inTopShare(current.clanPlace, current.clansRanked, share)
        ? null
        : t("clan-short", {
            share: pct.format(share),
            last: fmt.format(topShareLastPlace(current.clansRanked, share)),
            place: fmt.format(current.clanPlace),
          });
  const gaps = (...parts: (string | null)[]) =>
    parts.filter((x): x is string => x != null).join(" · ");
  const r = maneuversPlayerRewards({
    place: current.place,
    ranked: current.ranked,
    vehiclePositions: current.rewardPositions,
    accountBondsPercent: current.accountBondsPercent,
    clanPlace: current.clanPlace,
    clansRanked: current.clansRanked ?? 0,
    clanBondsPercent: current.clanBondsPercent,
  });

  return (
    <div className="border-t border-fd-border p-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-fd-muted-foreground">
        {t("title")}
      </div>
      <ul className="flex flex-col gap-1.5">
        {r.vehicle != null && current.rewardPositions != null ? (
          <Line
            ok={r.vehicle}
            label={t("vehicle")}
            detail={
              r.vehicle
                ? undefined
                : t("places-to-go", { places: fmt.format(current.place - current.rewardPositions) })
            }
          />
        ) : null}
        <Line
          ok={r.bonds > 0}
          label={
            r.bonds > 0
              ? r.multiplier > 1
                ? t("bonds-multiplied", {
                    bonds: fmt.format(r.bonds),
                    multiplier: num({ maximumFractionDigits: 1 }).format(r.multiplier),
                    total: fmt.format(r.totalBonds),
                  })
                : t("bonds", { bonds: fmt.format(r.bonds) })
              : t("no-bonds")
          }
          detail={
            r.nextTier
              ? t("next-tier", {
                  bonds: fmt.format(r.nextTier.bonds),
                  places: fmt.format(current.place - r.nextTier.place),
                })
              : undefined
          }
        />
        <Line
          ok={r.legend}
          badge={ManeuversBadge.Legend}
          label={t("badge", { badge: t("legend", { maneuvers }) })}
          detail={
            r.legend
              ? t("legend-battles", { share: pct.format(MANEUVERS_LEGEND_BATTLE_SHARE) })
              : gaps(playerGap(MANEUVERS_LEGEND_SHARE), clanGap(MANEUVERS_LEGEND_SHARE))
          }
        />
        <Line
          ok={r.hero}
          badge={ManeuversBadge.Hero}
          label={t("badge", { badge: t("hero", { maneuvers }) })}
          detail={
            r.hero
              ? t("clan-battles", { count: MANEUVERS_CLAN_BATTLES })
              : gaps(clanGap(MANEUVERS_HERO_SHARE))
          }
        />
        {r.medal ? <Line ok label={medal(r.medal)} /> : null}
      </ul>
      <p className="mt-3 text-xs text-fd-muted-foreground">{t("footnote")}</p>
    </div>
  );
}

/**
 * What a clan's standing is worth to it and to its members right now: gold for
 * the treasury, the multiplier on every member's bonds, the medal, and the two
 * badges its place puts within reach.
 */
export function ManeuversClanRewards({
  current,
  clanBondsPercent,
}: {
  current: { place: number; ranked: number | null; rewardPositions: number | null };
  clanBondsPercent: number | null;
}) {
  const { t, maneuvers, medal } = useNames();
  const { num } = useFormat();
  const fmt = num(INT_FORMAT);
  const pct = num(PCT_FORMAT);
  if (!current.ranked) return null;
  const ranked = current.ranked;
  const gap = (share: number) =>
    t("clans-short", {
      share: pct.format(share),
      last: fmt.format(topShareLastPlace(ranked, share)),
      place: fmt.format(current.place),
    });
  const multiplier = maneuversMultiplier(current.place, current.ranked, clanBondsPercent);
  const won = maneuversMedal(current.place);
  const hero = inTopShare(current.place, current.ranked, MANEUVERS_HERO_SHARE);
  const legend = inTopShare(current.place, current.ranked, MANEUVERS_LEGEND_SHARE);

  return (
    <div className="border-t border-fd-border p-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-fd-muted-foreground">
        {t("title")}
      </div>
      <ul className="flex flex-col gap-1.5">
        {current.rewardPositions != null ? (
          <Line ok={current.place <= current.rewardPositions} label={t("gold")} />
        ) : null}
        <Line
          ok={multiplier > 1}
          label={t("multiplier", {
            multiplier: num({ maximumFractionDigits: 1 }).format(multiplier),
          })}
        />
        <Line
          ok={hero}
          badge={ManeuversBadge.Hero}
          label={t("members-badge", { badge: t("hero", { maneuvers }) })}
          detail={hero ? undefined : gap(MANEUVERS_HERO_SHARE)}
        />
        <Line
          ok={legend}
          badge={ManeuversBadge.Legend}
          label={t("members-badge", { badge: t("legend", { maneuvers }) })}
          detail={
            legend
              ? t("legend-members", { share: pct.format(MANEUVERS_LEGEND_SHARE) })
              : gap(MANEUVERS_LEGEND_SHARE)
          }
        />
        {won ? <Line ok label={t("members-medal", { medal: medal(won) })} /> : null}
      </ul>
      <p className="mt-3 text-xs text-fd-muted-foreground">{t("footnote")}</p>
    </div>
  );
}
