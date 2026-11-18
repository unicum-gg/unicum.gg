import Link from "@/components/link";
import { toRoman } from "roman-numerals";
import type { Region } from "@unicum.gg/wargaming";
import { HangarBackdrop } from "@/components/tanks/hangar-backdrop";
import { NationFlag } from "@/components/tanks/nation-flag";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";

/** What a card needs to know about its vehicle. */
export type TankCardIdentity = {
  slug: string;
  tag: string;
  name: string;
  tier: number;
  type: string;
  nation: string;
  isPremium: boolean;
};

/**
 * A vehicle shown the way its own page shows it: the render lit on the hangar
 * floor, its name over the foot, and a link to it.
 *
 * The same three layers as the tank page's hero, in miniature, and it costs
 * little to repeat them. The backdrop is a single image shared by every card,
 * and the renders are the portal files next/image resizes to card width. A row
 * of contour icons would have been cheaper still, but a section about vehicles
 * worth looking at cannot be grey silhouettes.
 *
 * `overlay` sits in the top right corner of the picture and `caption` under the
 * name, which is all the callers differ on.
 */
export function TankCard({
  region,
  identity,
  sizes,
  overlay,
  badge,
  caption,
}: {
  region: Region;
  identity: TankCardIdentity;
  /** The card's width at each breakpoint, for both layers of the picture. */
  sizes: string;
  overlay?: React.ReactNode;
  /** Beside the name, after the tier. */
  badge?: React.ReactNode;
  caption?: React.ReactNode;
}) {
  const tier = identity.tier ? toRoman(identity.tier) : String(identity.tier);
  return (
    <Link
      href={ROUTES.TANK(region, identity.slug)}
      // `dark` on the card, exactly as the hero does it: the vehicle is lit
      // against a dark hangar in both themes, so the text over it is light in
      // both, and the tokens have to be re-resolved inside to match.
      className="dark block overflow-hidden rounded-lg border border-fd-border transition-colors hover:border-fd-muted-foreground/50"
    >
      {/* The hero's own aspect ratio, which is the render's: 1920x900 is 32/15,
          so the picture lands in the frame whole, at the scale and the position
          it was composed at. Any other ratio crops it, and a crop moves the
          vehicle off the mark the portal layout puts it on. */}
      <div className="relative isolate aspect-32/15 w-full overflow-hidden bg-fd-background">
        <HangarBackdrop
          region={region}
          tag={identity.tag}
          slug={identity.slug}
          name={identity.name}
          sizes={sizes}
        />
        {/* Fade under the text at the foot, and no higher: the vehicle sits
            above it and is the reason the card exists. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 from-0% via-black/45 via-18% to-transparent to-46%"
        />
        {overlay}
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <div className="flex items-center gap-1.5">
            <NationFlag
              nation={identity.nation}
              region={region}
              className="shrink-0"
            />
            <VehicleTypeIcon
              type={identity.type}
              premium={identity.isPremium}
              size={14}
              className="shrink-0"
            />
            <span
              className={cn(
                "truncate text-sm font-medium text-white",
                identity.isPremium && "text-[#ffc363]",
              )}
            >
              {identity.name}
            </span>
            <span className="shrink-0 text-xs text-white/70">{tier}</span>
            {badge}
          </div>
          {caption ? (
            <p className="mt-0.5 truncate text-xs text-white/70">{caption}</p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
