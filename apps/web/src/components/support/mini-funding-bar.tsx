"use client";

import Link from "@/components/link";
import useSWR from "swr";
import ROUTES from "@/constants/routes";
import { useMoney } from "@/hooks/use-money";
import { useTranslation } from "@/hooks/use-translation";
import { unicum } from "@/services/sdk";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Compact funding progress for the top bar: a thin bar plus "X% funded",
 * measuring what supporters have covered against the cumulative spend since
 * launch. Hovering shows the amounts; the whole thing links to
 * /support. Client-side so the server render of every page stays free of the
 * funding fetch.
 */
export function MiniFundingBar() {
  const money = useMoney();
  const { t } = useTranslation("components/support/mini-funding-bar");
  const { data } = useSWR("support-funding", () => unicum.support.funding(), {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const pct = data?.pct ?? 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={ROUTES.SUPPORT}
            className="flex items-center gap-2 whitespace-nowrap transition-opacity hover:opacity-80"
          >
            <span className="hidden shrink-0 text-fd-muted-foreground sm:inline">
              {t("label")}
            </span>
            <span className="relative h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-fd-border/70 sm:w-32">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-brand"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="shrink-0 font-medium tabular-nums text-brand">
              {t("funded", { pct })}
            </span>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          {data
            ? t("tooltip", {
                received: money.format(data.receivedEur),
                goal: money.format(data.goalEur),
              })
            : t("tooltip-loading")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
