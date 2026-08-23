import { Crest, CrestKind } from "@/components/entity/badges/crest";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Common Test crest, shown wherever a vehicle appears that only exists on the
 * test client. It has no battle statistics because nobody has played it on a
 * live server yet, and its characteristics can still change before release.
 */
export function CommonTestBadge({
  size = 16,
  changes,
  version,
}: {
  size?: number;
  /** Set on a released vehicle the test rebalances, to say how much. */
  changes?: number;
  /** The test build, e.g. `2.4.0.5415`. Set where the badge marks data read
   * from that build rather than the vehicle being unreleased. */
  version?: string;
}) {
  const label = version ? `Common Test ${version}` : "Common Test";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex"
            aria-label={
              changes
                ? `Changed by the Common Test: ${changes} characteristics`
                : version
                  ? `Read on the Common Test client, build ${version}`
                  : "Common Test vehicle"
            }
          >
            <Crest kind={CrestKind.CommonTest} size={size} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {changes
            ? `Common Test changes ${changes} characteristic${changes > 1 ? "s" : ""} on this vehicle`
            : version
              ? `${label} · these are the test build's values, and Wargaming can still change them before the update ships`
              : "Common Test · not released yet, so it has no battle statistics and its characteristics can still change"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
