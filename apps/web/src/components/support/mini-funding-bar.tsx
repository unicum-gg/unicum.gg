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
          {/* On intent, like the top bar's own /support link two elements
              over, and for a reason that only shows up in the server's logs:
              this bar is in the chrome of every page, so its prefetch fires on
              every view, and /support exists in 36 languages of which only
              English is prerendered. Measured 2026-11-13 on one client, this
              link alone was 170 of its 798 requests, each one a full render of
              a page nobody had asked for. */}
          <Link
            href={ROUTES.SUPPORT}
            prefetch="intent"
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
            <span className="shrink-0 font-medium tabular-nums text-brand-strong">
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
