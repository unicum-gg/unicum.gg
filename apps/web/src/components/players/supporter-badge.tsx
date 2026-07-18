"use client";

import { HeartIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export enum SupporterBadgeState {
  /** Public supporter: accent pill, visible to everyone. */
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
 * Small badge on a player header, linking to /support. The active state is the
 * public accent pill shown for supporters; the other two are muted, greyed pills
 * shown only to the logged-in owner of the profile, with a tooltip explaining
 * either that their badge is hidden (anonymous) or how to earn one.
 */
export function SupporterBadge({
  state,
  className,
}: {
  state: SupporterBadgeState;
  className?: string;
}) {
  const active = state === SupporterBadgeState.Active;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={ROUTES.SUPPORT}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
              active
                ? "border-[#f25322]/40 bg-[#f25322]/10 text-[#f25322] hover:bg-[#f25322]/20"
                : "border-fd-border text-fd-muted-foreground opacity-60 hover:opacity-100",
              className,
            )}
          >
            <HeartIcon weight={active ? "fill" : "regular"} className="size-3" />
            Supporter
          </Link>
        </TooltipTrigger>
        <TooltipContent>{TOOLTIP[state]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
