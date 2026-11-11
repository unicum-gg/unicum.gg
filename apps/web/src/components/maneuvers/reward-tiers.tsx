"use client";

import {
  ManeuversBadge,
  maneuversBadgeIconUrl,
  ManeuversBoardKind,
  ManeuversMedal,
  MANEUVERS_CLAN_BATTLES,
  MANEUVERS_HERO_SHARE,
  MANEUVERS_LEGEND_BATTLE_SHARE,
  MANEUVERS_LEGEND_SHARE,
  maneuversBondTiers,
  maneuversMultiplierTiers,
} from "@unicum.gg/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const PCT_FORMAT = { style: "percent", maximumFractionDigits: 0 } as const;

/**
 * The rest of an edition's rewards, below its headline one: the bond tiers of
 * the personal board, or the clan board's multipliers on them, as places on the
 * board as it stands, then the badges and medals and what each asks for. All
 * from the regulations, through the same arithmetic the profiles use, so a
 * tier here and a reward on a profile cannot disagree.
 */
export function ManeuversRewardTiers({
  kind,
  ranked,
  accountBondsPercent,
  clanBondsPercent,
}: {
  kind: ManeuversBoardKind;
  ranked: number;
  accountBondsPercent: number | null;
  clanBondsPercent: number | null;
}) {
  const { t } = useTranslation("components/maneuvers/reward-tiers");
  const { t: tPlay } = useTranslation("components/maneuvers/rewards-in-play");
  const { t: tGame } = useTranslation("game/vocabulary");
  const maneuvers = tGame("battle-formats.maneuvers");
  const { num } = useFormat();
  const fmt = num(INT_FORMAT);
  const pct = num(PCT_FORMAT);
  const players = kind === ManeuversBoardKind.Players;
  const tiers = players
    ? maneuversBondTiers(ranked, accountBondsPercent).map((x) => ({
        share: x.share,
        from: x.fromPlace,
        to: x.toPlace,
        value: t("bonds", { bonds: fmt.format(x.bonds) }),
      }))
    : maneuversMultiplierTiers(ranked, clanBondsPercent).map((x) => ({
        share: x.share,
        from: x.fromPlace,
        to: x.toPlace,
        value: `×${num({ maximumFractionDigits: 1 }).format(x.multiplier)}`,
      }));
  if (tiers.length === 0) return null;

  const awards = players
    ? [
        {
          badge: ManeuversBadge.Legend,
          name: tPlay("legend", { maneuvers }),
          rule: t("legend-rule", {
            share: pct.format(MANEUVERS_LEGEND_SHARE),
            battles: pct.format(MANEUVERS_LEGEND_BATTLE_SHARE),
          }),
        },
        {
          badge: ManeuversBadge.Hero,
          name: tPlay("hero", { maneuvers }),
          rule: t("hero-rule", {
            share: pct.format(MANEUVERS_HERO_SHARE),
            count: MANEUVERS_CLAN_BATTLES,
          }),
        },
      ]
    : [
        { medal: ManeuversMedal.Winner, rule: t("medal-place", { place: 1 }) },
        { medal: ManeuversMedal.Top2, rule: t("medal-place", { place: 2 }) },
        { medal: ManeuversMedal.Top3, rule: t("medal-place", { place: 3 }) },
        { medal: ManeuversMedal.Top10, rule: t("medal-top", { place: 10 }) },
        { medal: ManeuversMedal.Top100, rule: t("medal-top", { place: 100 }) },
      ].map((m) => ({
        badge: null,
        name: tPlay(`medals.${m.medal}`, { maneuvers }),
        rule: t("medal-rule", { rule: m.rule, count: MANEUVERS_CLAN_BATTLES }),
      }));

  return (
    <>
      <div className={cn("border-t border-fd-border p-4", styles.mutedDescription)}>
        {t(`intro.${kind}`)}
      </div>
      <Table className="mb-px! [&_td]:min-w-0! [&_th]:min-w-0! [&_tr]:h-11">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4!">{t("standing")}</TableHead>
            <TableHead>{t("places")}</TableHead>
            <TableHead className="pr-4 text-right!">{t(`value.${kind}`)}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tiers.map((x) => (
            <TableRow key={x.from}>
              <TableCell className="pl-4! font-medium">
                {x.share >= 1 ? t("rest") : t("top", { share: pct.format(x.share) })}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {x.from === x.to
                  ? fmt.format(x.from)
                  : t("range", { from: fmt.format(x.from), to: fmt.format(x.to) })}
              </TableCell>
              <TableCell className="pr-4 text-right tabular-nums">{x.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ul className="flex flex-col gap-1.5 border-t border-fd-border p-4 text-sm">
        {awards.map((a) => (
          <li key={a.name} className="flex items-center gap-2">
            {a.badge ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={maneuversBadgeIconUrl(a.badge, 24)}
                alt=""
                width={16}
                height={16}
                className="size-4 shrink-0"
              />
            ) : null}
            <span>
              <span className="font-medium">{a.name}</span>
              <span className="text-fd-muted-foreground"> · {a.rule}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
