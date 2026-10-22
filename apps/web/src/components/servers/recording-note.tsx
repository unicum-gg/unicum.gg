"use client";

import type { ReactNode } from "react";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { formatMoment } from "./format";
import { useDisplayZone } from "./use-display-zone";

/**
 * Why a panel on this page has nothing to draw.
 *
 * There are two reasons and they are not the same statement about us. A history
 * younger than the range fills in on its own, which is what the panels have
 * always said. A recording that STOPPED is Wargaming's source refusing to
 * answer (`wgn/servers/info`, 504 `SOURCE_NOT_AVAILABLE` on all three regions
 * since 2026-10-08), and saying "not enough recorded yet" about that reads as
 * our collection being young, which is the one thing it is not: it ran every
 * five minutes for months and the source went away.
 *
 * One component rather than the sentence written into each panel, because the
 * population chart, the regions chart and the rhythm grid empty out together on
 * the same cause, and three copies would be three wordings the day one of them
 * is corrected.
 *
 * Whether it is stalled is decided by the caller off the payload
 * (`isServerRecordingStalled`), never off a clock here: see that function for
 * why a timestamp comparison in a prerendered tree is a hydration mismatch.
 */
export function RecordingNote({
  stalled,
  until,
  instead,
  className,
}: {
  stalled: boolean;
  /** The newest sample on record, from the payload. */
  until: Date | null;
  /** What this panel says when the gap is a history too young for the range,
   * which is its own sentence about its own shape. */
  instead: ReactNode;
  className?: string;
}) {
  const { locale } = useFormat();
  const { t } = useTranslation("components/servers/recording-note");
  const zone = useDisplayZone();

  if (!stalled || !until) return <>{instead}</>;

  return (
    <span className={className}>
      {t("wargaming-has-not-published", {
        at: formatMoment(until, zone, locale),
      })}
    </span>
  );
}
