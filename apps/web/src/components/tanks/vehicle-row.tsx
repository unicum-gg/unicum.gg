import Link from "next/link";
import { toRoman } from "roman-numerals";
import type { Region } from "@unicum.gg/wargaming";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { Skeleton } from "@/components/ui/skeleton";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * One vehicle in a profile list: its icon, its name over tier/class/battles,
 * and a value on the right with a line under it saying what the value means.
 *
 * The shape the profile's panels keep needing. It is deliberately dumb about
 * the value: the caller passes a rendered `badge` and `caption`, since the
 * lift/drag columns put a rating and a removal delta there while the marks
 * panel puts combined damage and the marks the gun carries. Everything else is
 * identical, and was copied between them until this existed, which meant a
 * spacing change to one left the other misaligned inside the same panel stack.
 */
export function VehicleRow({
  region,
  tag,
  type,
  tier,
  isPremium,
  name,
  /** Links the name when given; plain text otherwise. */
  href,
  battles,
  /** Appended after the battle count, for a list that counts a window rather
   * than a lifetime. */
  battlesNote,
  badge,
  caption,
}: {
  region: Region;
  tag: string;
  type: string;
  tier: number;
  isPremium: boolean;
  name: string;
  href?: string;
  battles: number;
  battlesNote?: string;
  badge: React.ReactNode;
  caption: React.ReactNode;
}) {
  return (
    <li className={ROW_CLASS}>
      <span className={ICON_CELL_CLASS}>
        <TankIcon
          region={region}
          tag={tag}
          type={type}
          className="h-3 w-auto object-contain"
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {href ? (
            <Link href={href} className="hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
          <span>Tier {toRoman(tier)}</span>
          <VehicleTypeIcon
            type={type}
            premium={isPremium}
            className="size-3.5"
          />
          <span>
            · {intFmt.format(battles)} battles
            {battlesNote ?? ""}
          </span>
        </div>
      </div>
      <div className={VALUE_CELL_CLASS}>
        {badge}
        {caption}
      </div>
    </li>
  );
}

/** The loading twin, so a skeleton keeps the row's exact line boxes. */
export function VehicleRowSkeleton() {
  return (
    <li className={ROW_CLASS}>
      <span className={ICON_CELL_CLASS}>
        <Skeleton className="h-3 w-8" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          <Skeleton className="h-3.5 w-28" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className={VALUE_CELL_CLASS}>
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
    </li>
  );
}

const ROW_CLASS =
  "flex items-center gap-3 border-b border-fd-border/40 px-4 py-2 last:border-fd-border";
const ICON_CELL_CLASS = "flex w-10 shrink-0 items-center justify-center";
const VALUE_CELL_CLASS = "flex flex-col items-end gap-0.5 tabular-nums";
