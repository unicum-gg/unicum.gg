import { Crest, CrestKind } from "@/components/entity/badges/crest";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import APP from "@/constants/app";

/**
 * Verified crest, shown next to a player wherever they appear once the owner has
 * connected this WoT account on the site (Wargaming.net ID sign-in). Public by
 * design: connecting the account opts into a visible verified mark.
 */
export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" aria-label="Verified account">
            <Crest kind={CrestKind.Verified} size={size} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Verified account · connected on {APP.NAME}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
