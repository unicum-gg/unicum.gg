import type { TranslateFunction } from "@onruntime/translations";
import type { BattleEconomy } from "@unicum.gg/shared";
import type { Row } from "./battle-report-block";
import type { Participant } from "./battle-types";

/**
 * What a battle paid and cost one player, line by line: the credits from the
 * battle's own base through each bonus to what reached the account, the
 * experience the same way, and the bonds.
 *
 * Shared by the detailed report and a recorder's personal score, so the two
 * cannot itemise the same battle differently. Not a client module, so a
 * server component can call it too.
 */
export function economyRows({
  money,
  own,
  t,
  count,
}: {
  money: BattleEconomy;
  own: Participant["own"];
  t: TranslateFunction;
  count: Intl.NumberFormat;
}): {
  credits: (Row | null)[];
  experience: (Row | null)[];
  bonds: (Row | null)[];
  /** Whether the experience block carries a free experience column. */
  freeColumn: boolean;
} {
  const line = (
    label: string,
    value: number | undefined,
    opts: { under?: boolean; cost?: boolean; render?: (v: number) => string } = {},
  ): Row | null =>
    value === undefined
      ? null
      : {
          label,
          value: opts.render
            ? opts.render(value)
            : opts.cost
              ? `-${count.format(value)}`
              : count.format(value),
          under: opts.under,
          cost: opts.cost,
        };

  // The breakdown when the economy is there, the flat figure when it is not.
  // The vehicle line always carries what the battle itself paid (the public
  // results' `credits` is the uploader's `creditsBase`), so a report that
  // showed nothing at all until the mod started sending the breakdown would be
  // hiding a figure it has.
  //
  // `money.credits` is the GROSS, before the bills: it sits above
  // `creditsSubtotal` on nearly every battle and never equals it less the
  // costs. So it is the "with bonuses" line, what the listed bonuses do not
  // account for (the premium account, reserves the results do not itemise) is
  // its own line, and what reached the account is computed. Printing the gross
  // as credited turned a battle that cost 90,000 into one that paid 38,000.
  const costs =
    (money.repairCost ?? 0) + (money.ammoCost ?? 0) + (money.suppliesCost ?? 0);
  const listed =
    (money.creditsBase ?? 0) +
    (money.creditsBooster ?? 0) +
    (money.creditsEvent ?? 0) +
    (money.creditsOrder ?? 0) +
    (money.creditsWotPlus ?? 0) +
    (money.creditsCompensation ?? 0) -
    (money.creditsPenalty ?? 0);
  const unlisted =
    money.credits !== undefined && money.creditsBase !== undefined
      ? money.credits - listed
      : undefined;
  const credits: (Row | null)[] = money.credits === undefined
    ? [line(t("report.earned-for-battle"), own.credits)]
    : [
    line(t("report.earned-for-battle"), money.creditsBase),
    line(t("report.reserves"), money.creditsBooster, { under: true }),
    line(t("report.missions"), money.creditsEvent, { under: true }),
    line(t("report.orders"), money.creditsOrder, { under: true }),
    line(t("report.wot-plus"), money.creditsWotPlus, { under: true }),
    line(t("report.ally-fine"), money.creditsPenalty, { cost: true, under: true }),
    line(t("report.compensation"), money.creditsCompensation, { under: true }),
    line(t("report.other-bonuses"), unlisted !== undefined && unlisted > 0 ? unlisted : undefined, {
      under: true,
    }),
    line(t("report.with-bonuses"), money.credits),
    line(t("report.repair"), money.repairCost, { cost: true, under: true }),
    line(t("report.ammo"), money.ammoCost, { cost: true, under: true }),
    line(t("report.supplies"), money.suppliesCost, { cost: true, under: true }),
    line(t("report.credited"), money.credits - costs, {
      // A battle that cost more than it paid reads as a cost.
      cost: money.credits < costs,
      render: (v) => (v < 0 ? `-${count.format(-v)}` : count.format(v)),
    }),
    line(t("report.piggy-bank"), money.piggyBank),
  ];

  // An experience line and the free experience behind it, the game's two
  // columns. Either half can be absent: orders pay only free experience, a
  // premium vehicle only experience.
  const xpLine = (
    label: string,
    xp: number | undefined,
    free: number | undefined,
    opts: { under?: boolean; cost?: boolean } = {},
  ): Row | null =>
    xp === undefined && free === undefined
      ? null
      : {
          label,
          value:
            xp === undefined
              ? ""
              : opts.cost
                ? `-${count.format(xp)}`
                : count.format(xp),
          free: free === undefined ? "" : count.format(free),
          under: opts.under,
          cost: opts.cost,
        };
  // The first victory of the day multiplies both columns, and the game writes
  // the factor rather than a figure. Only when it applied: a factor of one is
  // what every other battle of the day carries.
  const daily = (money.xpDailyFactor ?? 0) > 10 ? money.xpDailyFactor! / 10 : null;
  // Whether the mod sent the free experience line by line. A battle reported
  // before it did has the total alone, which keeps its own line below.
  const freeColumn =
    money.freeXpBase !== undefined || money.freeXpSubtotal !== undefined;

  const xpListed =
    (money.xpBase ?? 0) +
    (money.xpBooster ?? 0) +
    (money.xpEvent ?? 0) +
    (money.xpPremiumVehicle ?? 0) +
    (money.xpWotPlus ?? 0) -
    (money.xpPenalty ?? 0);
  // Not when the first victory of the day doubled the base: the factor is
  // shown as its own line and the remainder would count it twice.
  const xpUnlisted =
    money.xp !== undefined && money.xpBase !== undefined && daily === null
      ? money.xp - xpListed
      : undefined;
  const experience: (Row | null)[] = money.xp === undefined
    ? [line(t("report.credited"), own.xp)]
    : [
    xpLine(t("report.earned-for-battle"), money.xpBase, money.freeXpBase),
    daily === null
      ? null
      : {
          label: t("report.first-win"),
          value: `×${daily}`,
          free: freeColumn ? `×${daily}` : undefined,
          under: true,
        },
    xpLine(t("report.reserves"), money.xpBooster, money.freeXpBooster, { under: true }),
    xpLine(t("report.missions"), money.xpEvent, money.freeXpEvent, { under: true }),
    xpLine(t("report.orders"), undefined, money.freeXpOrder, { under: true }),
    line(t("report.premium-vehicle"), money.xpPremiumVehicle, { under: true }),
    xpLine(t("report.wot-plus"), money.xpWotPlus, money.freeXpWotPlus, { under: true }),
    // What the listed lines do not account for, as the credits block has it:
    // the premium account's share above all, which the results never itemise
    // for experience. Without it the block did not add up to its own total.
    line(t("report.other-bonuses"), xpUnlisted !== undefined && xpUnlisted > 0 ? xpUnlisted : undefined, {
      under: true,
    }),
    line(t("report.ally-fine"), money.xpPenalty, { cost: true, under: true }),
    xpLine(t("report.credited"), money.xp, freeColumn ? money.freeXp : undefined),
    freeColumn ? null : line(t("report.free-xp"), money.freeXp),
    line(t("report.crew-xp"), money.crewXp),
  ];

  const bonds: (Row | null)[] = [
    line(t("report.earned-for-battle"), money.bondsBase),
    line(t("report.credited"), money.bonds),
  ];

  return {
    credits: credits.map((row) => (row ? { ...row, currency: "credits" as const } : row)),
    // The experience block's two value columns leave no room for an icon.
    experience: freeColumn
      ? experience
      : experience.map((row) => (row && row.value ? { ...row, currency: "xp" as const } : row)),
    bonds,
    freeColumn,
  };
}
