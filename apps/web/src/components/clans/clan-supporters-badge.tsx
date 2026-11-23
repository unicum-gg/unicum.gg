"use client";

import useSWR from "swr";
import { Crest, CrestKind } from "@/components/entity/badges/crest";
import Link from "@/components/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { useTranslation } from "@/hooks/use-translation";
import { unicum } from "@/services/sdk";
import type { Region } from "@unicum.gg/wargaming";

/**
 * How many of a clan's current members fund the site in its name. Fetched on
 * the client so the cached clan page and its payload stay as they are; zero
 * until it arrives and for nearly every clan, and never asked for when
 * `enabled` is false (a clan still loading, or one that has ended).
 */
export function useClanSupporters(
  region: Region,
  tag: string,
  enabled: boolean,
): number {
  const req = () => unicum.region(region).clans(tag).supporters();
  const { data } = useSWR(enabled ? req().url() : null, () => req(), {
    revalidateOnFocus: false,
  });
  return data?.supporters ?? 0;
}

/**
 * The tooltip line, shared by the crest and its entry in a folded cluster.
 * With nobody supporting yet, it is the invitation a member of the clan sees.
 */
export function useClanSupportersLabel(count: number, tag: string): string {
  const { t } = useTranslation("components/clans/clan-supporters-badge");
  if (count === 0) return t("invite", { NAME: APP.NAME, tag });
  return count === 1
    ? t("tooltip-one", { NAME: APP.NAME })
    : t("tooltip", { count, NAME: APP.NAME });
}

/**
 * The supporter crest a clan wears when some of its members fund the site in
 * its name. A crest like every other one: how many members is in the tooltip,
 * never beside it. Links to /support, where a member can add theirs.
 *
 * At zero it is drawn muted, and only ever for a signed-in member of the clan:
 * the same nudge the player page shows its owner (`SupporterBadgeState.Invite`),
 * saying what the crest is and how the clan gets it.
 */
export function ClanSupporterBadge({
  count,
  tag,
  size = 16,
}: {
  count: number;
  tag: string;
  size?: number;
}) {
  const label = useClanSupportersLabel(count, tag);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={ROUTES.SUPPORT}
            className="inline-flex"
            prefetch="intent"
            aria-label={label}
          >
            <Crest kind={CrestKind.Supporter} size={size} muted={count === 0} />
          </Link>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
