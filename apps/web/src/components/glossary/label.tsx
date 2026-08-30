"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useGlossaryAnchor } from "@/components/glossary/anchor-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";

/**
 * A label the glossary defines: hovering explains it in a sentence, clicking
 * opens the full entry.
 *
 * The anchor is looked up rather than passed, so a table keeps rendering the
 * label it always did and gains the definition for free. A label nothing
 * defines renders exactly as before, which is what makes this safe to wrap
 * around every heading in a table.
 */
export function GlossaryLabel({
  specKey,
  label,
  fallbackLabel,
  tip,
  className,
  children,
}: {
  /** The `tank_specs` column this label shows, when it has one. */
  specKey?: string;
  /** The label text to match on, defaulting to the rendered children when they
   * are a plain string. */
  label?: string;
  /** Tried when nothing defines `label`: a row that shows a variant of the one
   * above it ("… on soft ground") is the same term, measured differently. */
  fallbackLabel?: string;
  /** This column's own sentence, when it says something the definition cannot:
   * which of two columns sharing a term this one is, or over what window it is
   * measured. Shown above the definition, and on its own when nothing defines
   * the label. */
  tip?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const lookup = useGlossaryAnchor();
  const text = label ?? (typeof children === "string" ? children : undefined);
  const term =
    lookup({ specKey, label: text }) ??
    (fallbackLabel ? lookup({ label: fallbackLabel }) : null);
  if (!term) {
    if (!tip) return <>{children}</>;
    // A column with a tip and no definition still explains itself, and reads
    // like every other explained heading rather than like a dead link.
    //
    // `tabIndex` because the trigger is a span: the defined case is a link and
    // is reachable by keyboard on its own, and without this the readers who
    // most need the sentence would be the ones who never get it.
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className={cn("cursor-help", className)}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{tip}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={ROUTES.GLOSSARY_TERM(term.slug)}
          className={cn(
            "cursor-help decoration-dotted underline-offset-4 hover:underline",
            className,
          )}
        >
          {children}
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <span className="block">
          {tip ? <span className="block">{tip}</span> : null}
          <span className={tip ? "mt-1 block opacity-80" : undefined}>
            <span className="font-medium">{term.term}</span>
            {": "}
            {term.short}
          </span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
