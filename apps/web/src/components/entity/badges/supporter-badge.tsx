import { useTranslation } from "@/hooks/use-translation";
import Link from "@/components/link";
import { Crest, CrestKind } from "@/components/entity/badges/crest";
import { useSupporterTier } from "@/components/entity/badges/supporter-tier";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";

export enum SupporterBadgeState {
  /** Public supporter: accent crest, visible to everyone. */
  Active = "active",
  /** Owner only: a supporter, but hidden from the public because anonymous. */
  HiddenAnonymous = "hidden-anonymous",
  /** Owner only: not a supporter yet, a nudge to become one. */
  Invite = "invite",
}

/**
 * Supporter crest, linking to /support. The active state is the public crest,
 * in the metal the supporter's seniority earns (plain, then bronze at 3 months,
 * silver at 6, gold at 12) when `region` and `nickname` say whose it is; the
 * other two are slate crests shown only to the logged-in owner of the profile,
 * explaining that their badge is hidden (anonymous) or how to earn one.
 */
export function SupporterBadge({
  state,
  region,
  nickname,
  size = 16,
}: {
  state: SupporterBadgeState;
  region?: Region;
  nickname?: string;
  size?: number;
}) {
  const label = useSupporterBadgeLabel(state, region, nickname);
  const active = state === SupporterBadgeState.Active;
  const { kind } = useSupporterTier(active ? region : undefined, nickname);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={ROUTES.SUPPORT}
            className="inline-flex"
            // A badge is never the click a reader came for, and a table puts
            // dozens of them on one screen. See `prefetch` in
            // `@/components/link`.
            prefetch="intent"
            aria-label={label}
          >
            <Crest kind={active ? kind : CrestKind.Supporter} size={size} muted={!active} />
          </Link>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** What the crest says, shared by the badge and its entry in a folded cluster. */
export function useSupporterBadgeLabel(
  state: SupporterBadgeState,
  region?: Region,
  nickname?: string,
): string {
  const { t } = useTranslation("components/entity/badges/supporter-badge");
  const active = state === SupporterBadgeState.Active;
  const { months } = useSupporterTier(active ? region : undefined, nickname);
  if (state === SupporterBadgeState.HiddenAnonymous) {
    return t("hidden-anonymous");
  }
  if (state === SupporterBadgeState.Invite) {
    return t("invite", { NAME: APP.NAME });
  }
  if (!months) return t("thanks", { NAME: APP.NAME });
  return months === 1
    ? t("since-one", { NAME: APP.NAME })
    : t("since", { NAME: APP.NAME, count: months });
}
