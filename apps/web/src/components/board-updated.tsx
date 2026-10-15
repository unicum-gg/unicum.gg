"use client";

import { Interpolate } from "@/components/interpolate";
import { RelativeTime } from "@/components/relative-time";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

/**
 * When a leaderboard's rows were last computed, printed under its title.
 *
 * A reader asked whether the boards are refreshed at all, and the honest
 * answer is a timestamp rather than a cadence written in prose: the hourly
 * cron can be late, and a stated "every hour" would keep saying so. It dates
 * the ranking, not each player's figures, which ride their own refresh.
 * Renders nothing when the endpoint has no stamp to give.
 */
export function BoardUpdated({
  at,
  className,
}: {
  at: Date | string | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation("components/board-updated");
  if (!at) return null;
  return (
    <p className={cn("text-xs font-normal text-fd-muted-foreground", className)}>
      <Interpolate
        template={t("updated")}
        values={{ when: <RelativeTime date={new Date(at)} /> }}
      />
    </p>
  );
}
