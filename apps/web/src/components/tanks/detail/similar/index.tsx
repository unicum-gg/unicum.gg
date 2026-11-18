"use client";

import Link from "@/components/link";
import { ArrowRight } from "lucide-react";
import type { Region } from "@unicum.gg/wargaming";
import { TANK_AXIS_LABEL, type TankAxis } from "@unicum.gg/shared";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { TankCard } from "@/components/tanks/tank-card";
import { MAX_COMPARE_TANKS } from "@/constants/compare";
import ROUTES from "@/constants/routes";
import type { SimilarTankRow } from "@/app/api/[region]/tanks/[slug]/similar/schema.api";
import { useTranslation } from "@/hooks/use-translation";
import { tankParamName } from "@/components/game-name";

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
  const { t: tSim } = useTranslation("components/tanks/detail/similar");
  const { t: tSection } = useTranslation("components/tanks/detail/sections");
  if (results.length === 0) return null;
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <PanelTitle>{tSection("similar", { tank: tankName })}</PanelTitle>
        <span className="text-xs text-fd-muted-foreground">
          {tSim("subtitle")}
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

/** One match, shown the way the page above shows its own vehicle. */
function SimilarTankCard({
  region,
  tank,
}: {
  region: Region;
  tank: SimilarTankRow;
}) {
  return (
    <TankCard
      region={region}
      identity={tank.identity}
      sizes={CARD_SIZES}
      overlay={<MatchScore score={tank.score} />}
      caption={<Verdict closest={tank.closest} furthest={tank.furthest} />}
    />
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
  const { t: tSim } = useTranslation("components/tanks/detail/similar");
  const { t: tParams } = useTranslation("game/tank-params");
  // Looked up defensively, though the type says it cannot miss. These rows
  // crossed HTTP as plain strings and are served from a day-long cache, so a
  // renamed axis would arrive here as a value the label map has never heard of,
  // and an unguarded `.toLowerCase()` on the miss would take down the whole
  // Specifications tab rather than one line of copy.
  const axisName = (axis: TankAxis) =>
    tankParamName(axis, TANK_AXIS_LABEL[axis] ?? axis, tParams).toLowerCase();
  const alike = closest.map(axisName).filter(Boolean);
  if (alike.length === 0) return <>{tSim("verdict.overall")}</>;
  const apart =
    furthest && !closest.includes(furthest)
      ? axisName(furthest)
      : null;
  const axes = alike.join(` ${tSim("verdict.and")} `);
  return (
    <>
      {apart
        ? tSim("verdict.closest-furthest", { axes, apart })
        : tSim("verdict.closest", { axes })}
    </>
  );
}

/** How close the match is. Kept as a plain number with its unit spelled out:
 * a bar or a ring would suggest a precision this measurement does not have. */
function MatchScore({ score }: { score: number }) {
  const { t: tSim } = useTranslation("components/tanks/detail/similar");
  return (
    <div className="absolute right-2 top-2 z-10 rounded-md bg-black/55 px-2 py-1 text-right leading-none backdrop-blur-sm">
      <div className="text-sm font-semibold tabular-nums text-white">
        {score}%
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wide text-white/60">
        {tSim("match")}
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
  const { t: tSim } = useTranslation("components/tanks/detail/similar");
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
        {tSim("compare", { count: against.length })}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
