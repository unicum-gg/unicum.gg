"use client";

import Link from "@/components/link";
import type { ReactElement, ReactNode } from "react";
import { useGlossaryAnchor } from "@/components/glossary/anchor-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";

/**
 * The definition a column header carries, for the headers that cannot be a link
 * themselves.
 *
 * Most table headings are a sort button, so the wording a reader would click is
 * already spoken for. The definition therefore lives in the tooltip, and so
 * does the way out to the full entry: the tooltip content is hoverable, so a
 * reader moves onto it and clicks the term.
 *
 * `tip` and the definition are both shown when both exist: the tip says which
 * column this is ("Rating of these battles alone"), the definition says what
 * the thing is. A header nothing defines and nothing tips renders exactly as it
 * did, which is what makes this safe to wrap around every heading of every
 * table.
 *
 * It also carries the heading itself. Column widths are set for the English and
 * a translation is routinely longer ("Rating points" is "Points de classement"),
 * so the heading is cut rather than allowed to spill over the numbers beside it,
 * and the full wording has to stay reachable.
 *
 * Shown whether or not it is actually cut, which is deliberate. Whether a
 * heading fits depends on the language, the viewport and the font, and reading
 * that back was measurable but not reliable: the box is already the width of
 * its column, so what changes when the real typeface arrives is `scrollWidth`,
 * which no observer reports. A tooltip that sometimes fails to appear on a
 * heading a reader cannot read is worse than one that sometimes repeats a
 * heading they can.
 */
export function GlossaryHeadTooltip({
  specKey,
  label,
  fallbackLabel,
  tip,
  children,
}: {
  /** The `tank_specs` column this header shows, when it has one. */
  specKey?: string;
  /** The heading to match on, which is the text inside `children`. */
  label?: string;
  /** Tried when nothing defines `label`. */
  fallbackLabel?: string;
  /** This column's own sentence, when it needs one beyond the definition. */
  tip?: ReactNode;
  /** The trigger, which is the header's own button or span. */
  children: ReactElement;
}) {
  const lookup = useGlossaryAnchor();
  const term =
    lookup({ specKey, label }) ??
    (fallbackLabel ? lookup({ label: fallbackLabel }) : null);
  if (!label && !tip && !term) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <span className="block">
          {label ? (
            <span className={cn("block font-medium", (tip || term) && "mb-1")}>
              {label}
            </span>
          ) : null}
          {tip ? <span className="block">{tip}</span> : null}
          {term ? (
            <Link
              href={ROUTES.GLOSSARY_TERM(term.slug)}
              className={cn("block hover:underline", tip && "mt-1 opacity-80")}
            >
              {/* The name is underlined even at rest: it is the only sign the
                  reader gets that this tooltip leads somewhere, since the
                  heading it hangs off is a sort button. */}
              <span className="font-medium underline decoration-dotted underline-offset-2">
                {term.term}
              </span>
              {": "}
              {term.short}
            </Link>
          ) : null}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
