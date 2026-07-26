import { HoverPrefetchLink as Link } from "@/components/hover-prefetch-link";
import { Crest, CrestKind } from "@/components/entity/badges/crest";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";

export enum SupporterBadgeState {
  /** Public supporter: accent crest, visible to everyone. */
  Active = "active",
  /** Owner only: a supporter, but hidden from the public because anonymous. */
  HiddenAnonymous = "hidden-anonymous",
  /** Owner only: not a supporter yet, a nudge to become one. */
  Invite = "invite",
}

const TOOLTIP: Record<SupporterBadgeState, string> = {
  [SupporterBadgeState.Active]: `Thank you for supporting ${APP.NAME}`,
  [SupporterBadgeState.HiddenAnonymous]:
    "Your supporter badge is hidden while you appear anonymous. Turn off anonymity on the support page to show it.",
  [SupporterBadgeState.Invite]: `Support ${APP.NAME} to get this badge`,
};

/**
 * Supporter crest, linking to /support. The active state is the public accent
 * crest shown for supporters; the other two are slate crests shown only to the
 * logged-in owner of the profile, explaining that their badge is hidden
 * (anonymous) or how to earn one.
 */
export function SupporterBadge({
  state,
  size = 16,
}: {
  state: SupporterBadgeState;
  size?: number;
}) {
  const active = state === SupporterBadgeState.Active;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={ROUTES.SUPPORT}
            className="inline-flex"
            aria-label="Supporter"
          >
            <Crest kind={CrestKind.Supporter} size={size} muted={!active} />
          </Link>
        </TooltipTrigger>
        <TooltipContent>{TOOLTIP[state]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
