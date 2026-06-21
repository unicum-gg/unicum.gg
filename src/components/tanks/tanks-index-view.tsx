import Link from "next/link";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/players/nation-flag";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import { styles } from "@/lib/styles";
import type { TankCommunityStats } from "@/services/tanks/aggregates";
import { nationLabel, typeLabel } from "@/services/tanks/labels";
import type { VehicleMeta } from "@/services/wargaming/wot/encyclopedia";
import {
  RATING_COLOR_CLASS,
  winrateColor,
} from "@/services/wargaming/wot/ratings";
import { Region, REGION_EMOJI, REGION_LABEL } from "@/services/wargaming/wot";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// Heaviest class first within a tier, then alphabetic. Mirrors how the
// in-game tech tree and competitor sites order a tier.
const TYPE_ORDER: Record<string, number> = {
  heavyTank: 0,
  mediumTank: 1,
  "AT-SPG": 2,
  lightTank: 3,
  SPG: 4,
};

type TankRow = {
  tankId: number;
  meta: VehicleMeta;
  stats: TankCommunityStats | null;
};

function buildTiers(
  encyclopedia: Record<string, VehicleMeta>,
  stats: Map<number, TankCommunityStats>,
): Array<{ tier: number; rows: TankRow[] }> {
  const byTier = new Map<number, TankRow[]>();
  for (const [id, meta] of Object.entries(encyclopedia)) {
    if (!meta.name || meta.tier < 1) continue;
    const tankId = Number(id);
    const arr = byTier.get(meta.tier) ?? [];
    arr.push({ tankId, meta, stats: stats.get(tankId) ?? null });
    byTier.set(meta.tier, arr);
  }
  for (const rows of byTier.values()) {
    rows.sort((a, b) => {
      const ta = TYPE_ORDER[a.meta.type] ?? 9;
      const tb = TYPE_ORDER[b.meta.type] ?? 9;
      if (ta !== tb) return ta - tb;
      const pa = a.stats?.players ?? 0;
      const pb = b.stats?.players ?? 0;
      if (pa !== pb) return pb - pa;
      return a.meta.name.localeCompare(b.meta.name);
    });
  }
  return Array.from(byTier.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([tier, rows]) => ({ tier, rows }));
}

export function TanksIndexView({
  region,
  encyclopedia,
  stats,
}: {
  region: Region;
  encyclopedia: Record<string, VehicleMeta>;
  stats: Map<number, TankCommunityStats>;
}) {
  const tiers = buildTiers(encyclopedia, stats);
  const totalTanks = tiers.reduce((sum, t) => sum + t.rows.length, 0);
  const label = REGION_LABEL[region];

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-10 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {label}
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
            World of Tanks vehicles
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            Community stats for{" "}
            <span className="text-[#f25322]">
              {intFmt.format(totalTanks)}
            </span>{" "}
            World of Tanks vehicles on {label}, aggregated from every tracked
            player&apos;s tank-by-tank history. Pick a vehicle to see its
            average win rate, damage and most-played player base, or browse{" "}
            <Link href={ROUTES.PLAYERS(region)} className={styles.linkHover}>
              top players
            </Link>{" "}
            and{" "}
            <Link href={ROUTES.CLANS(region)} className={styles.linkHover}>
              clans
            </Link>
            .
          </p>
        </PanelContent>
      </Panel>

      {tiers.map(({ tier, rows }) => (
        <div key={tier} id={`tier-${tier}`}>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>
                Tier {toRoman(tier)} ({intFmt.format(rows.length)})
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="hidden sm:table-cell">Class</TableHead>
                    <TableHead className="hidden text-center sm:table-cell">
                      Nation
                    </TableHead>
                    <TableHead className="text-right">Players</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      Avg damage
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const isPremium = r.meta.isPremium;
                    const wr = r.stats?.avgWinrate ?? null;
                    return (
                      <TableRow key={r.tankId}>
                        <TableCell
                          className={cn(
                            "font-medium",
                            isPremium && "text-[#FAB81B]",
                          )}
                        >
                          <Link
                            href={ROUTES.TANK(region, r.tankId)}
                            className="hover:underline"
                          >
                            {r.meta.name}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden text-fd-muted-foreground sm:table-cell">
                          {typeLabel(r.meta.type)}
                        </TableCell>
                        <TableCell className="hidden text-center sm:table-cell">
                          <span
                            className="inline-flex items-center gap-1.5"
                            title={nationLabel(r.meta.nation)}
                          >
                            <NationFlag nation={r.meta.nation} />
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.stats ? intFmt.format(r.stats.players) : "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            wr !== null && RATING_COLOR_CLASS[winrateColor(wr)],
                          )}
                        >
                          {wr !== null ? `${pctFmt.format(wr * 100)}%` : "—"}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {r.stats?.avgDamage != null
                            ? intFmt.format(r.stats.avgDamage)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </PanelContent>
          </Panel>
        </div>
      ))}
    </div>
  );
}
