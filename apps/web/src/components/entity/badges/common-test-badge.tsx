"use client";

import { useTranslation } from "@/hooks/use-translation";
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
  description,
}: {
  size?: number;
  /** Set on a released vehicle the test rebalances, to say how much. */
  changes?: number;
  /** The test build, e.g. `2.4.0.5415`. Set where the badge marks data read
   * from that build rather than the vehicle being unreleased. */
  version?: string;
  /** What the badge says on something that is not a vehicle. The crest means the
   * same thing everywhere, but "no battle statistics" only makes sense on one. */
  description?: string;
}) {
  const { t } = useTranslation("components/entity/badges/common-test-badge");
  const label = version ? t("common-test-build", { version }) : t("common-test");
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex"
            aria-label={
              description
                ? t("aria-described", { description })
                : changes
                  ? t("aria-changes", { changes })
                  : version
                    ? t("aria-build", { version })
                    : t("aria-vehicle")
            }
          >
            <Crest kind={CrestKind.CommonTest} size={size} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {description
            ? t("tip-described", { description })
            : changes
              ? t("tip-changes", { changes })
              : version
                ? t("tip-build", { label })
                : t("tip-vehicle")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
