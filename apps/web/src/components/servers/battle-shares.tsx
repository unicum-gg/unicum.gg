import {
  type BattleShare,
  RATING_COLOR_HEX,
  type TierShare,
  type TypeShare,
  totalBattles,
  VEHICLE_CLASS_LABEL_FULL,
  VEHICLE_CLASSES,
  winrateColor,
} from "@unicum.gg/shared";
import { PanelTitle } from "@/components/panel";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { formatShare } from "./format";

/**
 * Where the region's battles are actually fought: by tier, and by vehicle
 * class.
 *
 * Battles rather than vehicles, because the two say opposite things. Tier VIII
 * has 250 tanks and tier X has 125, which makes tier VIII look like the deeper
 * pool; it also has six billion battles to tier X's four, which is the fact a
 * player cares about. The win rate beside each row is battle-weighted for the
 * same reason.
 *
 * A table with headers rather than a bare list. Two of these columns are
 * percentages of entirely different things, the share of the region's battles
 * and the win rate inside them, and unlabelled side by side one reads as
 * contradicting the other.
 */

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const ROMAN = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
];

export function BattleShares({
  byTier,
  byType,
}: {
  byTier: TierShare[];
  byType: TypeShare[];
}) {
  // Ordered by the site's own class order rather than by the alphabet the
  // database returns.
  const types = [...byType].sort(
    (a, b) => VEHICLE_CLASSES.indexOf(a.type) - VEHICLE_CLASSES.indexOf(b.type),
  );

  return (
    // Two sections side by side, divided rather than merely spaced: the rule is
    // what says they are separate readings of the same panel and not one list
    // that happens to wrap.
    <div className="grid divide-y divide-fd-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
      <ShareTable
        title="By tier"
        unit="Tier"
        rows={byTier.map((t) => ({
          label: ROMAN[t.tier] ?? String(t.tier),
          ...t,
        }))}
      />
      <ShareTable
        title="By class"
        unit="Class"
        rows={types.map((t) => ({
          label: VEHICLE_CLASS_LABEL_FULL[t.type] ?? t.type,
          // The game's own class glyph, the same one the tank tables and the
          // player pages carry, so a class is recognised before it is read.
          icon: <VehicleTypeIcon type={t.type} size={14} />,
          ...t,
        }))}
      />
    </div>
  );
}

function ShareTable({
  title,
  unit,
  rows,
}: {
  title: string;
  /** What the first column names, so its header says "Tier" or "Class" instead
   * of repeating the section's own title. */
  unit: string;
  rows: (BattleShare & { label: string; icon?: React.ReactNode })[];
}) {
  const total = totalBattles(rows);
  // The bar is scaled against the biggest row rather than against the total, so
  // the smallest rows stay a visible bar instead of a sliver. It draws the very
  // share printed next to it, which is why the two share one cell: a bar in a
  // column of its own would have been a fifth unlabelled thing to decode.
  const widest = rows.reduce((max, r) => Math.max(max, r.battles), 0);

  return (
    <section>
      {/* The same heading band the distribution panel's sections use, so both
          panels' sections read alike on screen and in the outline. */}
      <div className="flex flex-wrap items-center gap-x-3 border-b border-fd-border px-4 py-2.5">
        <PanelTitle as="h3" className="text-base">
          {title}
        </PanelTitle>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fd-border text-xs uppercase tracking-wide text-fd-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">{unit}</th>
              <th className="px-4 py-2 text-left font-medium">
                Share of battles
              </th>
              <th className="px-4 py-2 text-right font-medium">Battles</th>
              <th className="px-4 py-2 text-right font-medium">Win rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-fd-border last:border-b-0"
              >
                <td
                  className="px-4 py-2 font-medium"
                  title={`${row.tanks} vehicles`}
                >
                  <span className="flex items-center gap-2">
                    {row.icon}
                    {row.label}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    <span className="h-3 flex-1 overflow-hidden rounded-[2px] bg-fd-border/40">
                      <span
                        className="block h-full rounded-[2px] bg-brand/70"
                        style={{
                          width:
                            widest > 0 ? `${(row.battles / widest) * 100}%` : 0,
                        }}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right tabular-nums">
                      {total > 0 ? formatShare(row.battles / total) : "—"}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-fd-muted-foreground">
                  {compact.format(row.battles)}
                </td>
                <td
                  className="px-4 py-2 text-right tabular-nums"
                  style={{ color: RATING_COLOR_HEX[winrateColor(row.winrate)] }}
                >
                  {(row.winrate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
