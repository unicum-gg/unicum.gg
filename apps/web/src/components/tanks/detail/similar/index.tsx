import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { toRoman } from "roman-numerals";
import type { Region } from "@unicum.gg/wargaming";
import { TANK_AXIS_LABEL, type TankAxis } from "@unicum.gg/shared";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { HangarBackdrop } from "@/components/tanks/hangar-backdrop";
import { NationFlag } from "@/components/tanks/nation-flag";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { MAX_COMPARE_TANKS } from "@/constants/compare";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { SimilarTankRow } from "@/app/api/[region]/tanks/[slug]/similar/schema.api";

/**
 * The vehicles that play like this one.
 *
 * Sits at the foot of the Specifications tab, where a reader has just finished
 * the characteristics and the question "what else is like this" is the one they
 * actually have. Every card is a link, so it is also the densest internal
 * linking on the site: 1200 vehicle pages, each pointing at the six nearest to
 * it, along an edge a reader has a reason to follow.
 *
 * Rendered on the server with the page, not fetched in the browser: the page is
 * ISR, so these links are in the cached HTML rather than behind a request that
 * a crawler never makes.
 */
export function SimilarTanks({
  region,
  slug,
  tankName,
  results,
}: {
  region: Region;
  /** The vehicle being read, so the comparison can be built around it. */
  slug: string;
  tankName: string;
  results: SimilarTankRow[];
}) {
  if (results.length === 0) return null;
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <PanelTitle>Tanks like the {tankName}</PanelTitle>
        <span className="text-xs text-fd-muted-foreground">
          Same standing among their own tier
        </span>
      </PanelHeader>
      <PanelContent className="px-4 py-4">
        {/* `grid-cols-1` spelled out, not left implicit: an implicit grid column
            is sized to its content, which on a single column let a card grow
            past the page instead of fitting it. */}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((tank) => (
            <li key={tank.identity.tankId}>
              <SimilarTankCard region={region} tank={tank} />
            </li>
          ))}
        </ul>
        <CompareLink region={region} slug={slug} results={results} />
      </PanelContent>
    </Panel>
  );
}

/**
 * Three cards a row at full width, two on a tablet, one on a phone.
 *
 * Declared once because the backdrop and the render fill the same box: asking
 * the CDN for two different widths would fetch one of them at the wrong size.
 */
const CARD_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

/**
 * One match, shown the way the page above shows its own vehicle: the render lit
 * on the hangar floor.
 *
 * The same three layers as the hero, in miniature, and it costs little to
 * repeat them. The backdrop is a single image shared by every card and by the
 * hero the reader has already loaded, and the renders are the portal files
 * next/image resizes to card width. A row of contour icons would have been
 * cheaper still, but a page whose headline is a lit vehicle cannot end on grey
 * silhouettes and still read as the same page.
 */
function SimilarTankCard({
  region,
  tank,
}: {
  region: Region;
  tank: SimilarTankRow;
}) {
  const { identity } = tank;
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
          sizes={CARD_SIZES}
        />
        {/* Fade under the two lines of text at the foot, and no higher: the
            vehicle sits above them and is the reason the card exists. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 from-0% via-black/45 via-18% to-transparent to-46%"
        />
        <MatchScore score={tank.score} />
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
          </div>
          <p className="mt-0.5 truncate text-xs text-white/70">
            <Verdict closest={tank.closest} furthest={tank.furthest} />
          </p>
        </div>
      </div>
    </Link>
  );
}

/**
 * Why these two are paired, and where the pairing stops.
 *
 * "Closest", not "alike": the axes are ranked against how far this vehicle sits
 * from its other candidates, so what is named is what sets this pairing apart
 * from the rest of the list, not what every tank of the class happens to share
 * (see `distinguishingAxes`). The second half is the part that earns its space.
 * Naming only the agreement reads as a claim to be taken on faith, while saying
 * where the two part company is what someone choosing between them needs.
 */
function Verdict({
  closest,
  furthest,
}: {
  closest: TankAxis[];
  furthest: TankAxis | null;
}) {
  // Looked up defensively, though the type says it cannot miss. These rows
  // crossed HTTP as plain strings and are served from a day-long cache, so a
  // renamed axis would arrive here as a value the label map has never heard of,
  // and an unguarded `.toLowerCase()` on the miss would take down the whole
  // Specifications tab rather than one line of copy.
  const alike = closest.map((axis) => TANK_AXIS_LABEL[axis]?.toLowerCase()).filter(Boolean);
  if (alike.length === 0) return <>Similar overall</>;
  const apart =
    furthest && !closest.includes(furthest)
      ? (TANK_AXIS_LABEL[furthest]?.toLowerCase() ?? null)
      : null;
  return (
    <>
      Closest on {alike.join(" and ")}
      {apart ? `, furthest on ${apart}` : null}
    </>
  );
}

/** How close the match is. Kept as a plain number with its unit spelled out:
 * a bar or a ring would suggest a precision this measurement does not have. */
function MatchScore({ score }: { score: number }) {
  return (
    <div className="absolute right-2 top-2 z-10 rounded-md bg-black/55 px-2 py-1 text-right leading-none backdrop-blur-sm">
      <div className="text-sm font-semibold tabular-nums text-white">
        {score}%
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wide text-white/60">
        match
      </div>
    </div>
  );
}

/**
 * Straight into the comparison, prefilled with the closest matches.
 *
 * The measurement says these vehicles are alike; the comparison is where a
 * reader finds out how, line by line. Building the link here saves them picking
 * the same three names by hand out of the list they just read.
 */
function CompareLink({
  region,
  slug,
  results,
}: {
  region: Region;
  slug: string;
  results: SimilarTankRow[];
}) {
  // The vehicle itself takes the first column, so the comparison holds one
  // fewer match than it does vehicles.
  const against = results.slice(0, MAX_COMPARE_TANKS - 1);
  if (against.length < 1) return null;
  const href = ROUTES.COMPARE_TANKS(region, [
    slug,
    ...against.map((tank) => tank.identity.slug),
  ]);
  return (
    <div className="mt-3 flex justify-end">
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-xs text-fd-muted-foreground transition-colors hover:text-fd-foreground"
      >
        Compare with the {against.length} closest
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
