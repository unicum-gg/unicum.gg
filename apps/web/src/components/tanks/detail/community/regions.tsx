import type { RegionVerdict } from "@unicum.gg/shared";
import { REGION_LABEL } from "@unicum.gg/wargaming";
import { Stars, StarValue } from "./stars";

const intFmt = new Intl.NumberFormat("en-US");

/**
 * The same tank, as each server sees it.
 *
 * The headline average is global on purpose: a tank is balanced identically
 * everywhere, and splitting the votes three ways would leave three averages
 * none of which deserve to be read. The split is still worth printing, because
 * what does differ is the meta around the vehicle, and a tank the EU crowd
 * rates a full star above NA is telling you something about how it is played
 * rather than about how it is built.
 *
 * Only servers that actually voted appear. An absent region is a fact about our
 * sign-ups, not about the tank.
 */
export function RegionSplit({ regions }: { regions: RegionVerdict[] }) {
  const voted = regions.filter((r) => r.votes > 0);
  if (voted.length < 2) return null;

  return (
    <div className="flex flex-col gap-2">
      {voted.map((region) => (
        <div
          key={region.region}
          className="grid grid-cols-[4.5rem_auto_1fr] items-center gap-3 text-sm"
        >
          <span className="text-fd-muted-foreground">
            {REGION_LABEL[region.region]}
          </span>
          <div className="flex items-center gap-2">
            <StarValue value={region.overall} className="w-9 text-xs" />
            <Stars value={region.overall} size={12} />
          </div>
          <span className="text-xs text-fd-muted-foreground tabular-nums">
            {intFmt.format(region.votes)}{" "}
            {region.votes === 1 ? "vote" : "votes"}
          </span>
        </div>
      ))}
    </div>
  );
}
