"use client";

import { CaretRightIcon } from "@phosphor-icons/react";
import { useTranslation } from "@/hooks/use-translation";
import Link from "@/components/link";
import type { StrongholdTableSection } from "@/components/players/detail/overview/stronghold-stats-table";
import { withTankMode } from "@/hooks/use-tank-mode";
import { TankBattleMode } from "@unicum.gg/shared";
import type { unicum } from "@/services/sdk";
import type { ReactNode } from "react";

export type PlayerSkirmishData = Awaited<
  ReturnType<ReturnType<ReturnType<typeof unicum.region>["players"]>["skirmish"]>
>;

/** The rows each tier repeats: the volume, the outcome and the two figures a
 * tier changes most. The full set twelve times over is a table nobody reads. */
const TIER_ROWS = ["Battles", "Wins", "Damages", "Experience"];

/** Keys of the clan table's own headings, so a tier reads the same on a
 * player's page as on their clan's. */
const TIER_SECTION: Record<number, string> = {
  11: "sections.t11",
  10: "sections.t10",
  8: "sections.t8",
  6: "sections.t6",
};

/**
 * The Skirmish record split by tier, as bands under the account's own rows,
 * the clan stronghold table's shape.
 *
 * Wargaming publishes that split for clans only, so it is rebuilt from the
 * player's per-vehicle Skirmish blocks (see `getPlayerSkirmishTiers`). Tiers
 * run from the highest down like the clan table, and the formats Skirmishes had
 * before come last, when there is anything in them. The windows come from the
 * per-tier history kept beside the per-vehicle blocks, and stay empty until it
 * reaches back far enough.
 *
 * Nothing at all for a player whose vehicles carry no Skirmish yet (their
 * garage not read since the breakdown existed): the table stays as it was.
 */
export function useSkirmishTierSections(
  data: PlayerSkirmishData | null | undefined,
  tanksHref?: string,
): {
  sections?: StrongholdTableSection[];
  leadTitle?: ReactNode;
  note?: ReactNode;
} {
  const { t } = useTranslation(
    "components/players/detail/overview/skirmish-tiers",
  );
  const { t: tClan } = useTranslation(
    "components/clans/detail/overview/stronghold-stats",
  );
  const { t: tGame } = useTranslation("game/vocabulary");
  const tiers = data?.tiers ?? [];
  if (tiers.length === 0) return {};
  const skirmish = tGame("features.skirmish");

  const ordered = [
    ...tiers.filter((c) => c.tier !== null).sort((a, b) => b.tier! - a.tier!),
    ...tiers.filter((c) => c.tier === null),
  ];
  const hasLegacy = ordered.some((c) => c.tier === null);

  return {
    leadTitle: t("all-tiers", { skirmish }),
    sections: ordered.map((c) => {
      const label =
        c.tier === null
          ? t("older-formats")
          : tClan(TIER_SECTION[c.tier] ?? "sections.t10", { skirmish });
      return {
        id: String(c.tier ?? "legacy"),
        stats: c.stats,
        periods: c.periods,
        rows: TIER_ROWS,
        title:
          c.tier !== null && tanksHref ? (
            // Into the garage at this tier in this mode, which is exactly the
            // vehicles this block adds up.
            <Link
              href={`${withTankMode(tanksHref, TankBattleMode.Skirmish)}&tier=${c.tier}`}
              className="group inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              {label}
              <CaretRightIcon
                weight="bold"
                className="size-3 opacity-0 transition-opacity group-hover:opacity-100"
              />
            </Link>
          ) : (
            label
          ),
      };
    }),
    note: (
      <>
        {t("note")}
        {hasLegacy && <> {t("note-older-formats")}</>}
      </>
    ),
  };
}
