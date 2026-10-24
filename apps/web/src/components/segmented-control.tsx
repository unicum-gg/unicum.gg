"use client";

import type { ReactNode } from "react";
import Link from "@/components/link";
import { cn } from "@/lib/utils";

/**
 * One choice in the control. A segment that carries an `href` navigates, which
 * is what the language leaderboards need (each scope is its own indexable URL);
 * one without it reports through `onSelect`, for a choice that is only a way of
 * reading what is already on screen.
 */
export type Segment<T extends string> = {
  id: T;
  /**
   * What the reader sees, in the reader's language.
   *
   * Translated by the caller, because only the caller knows which
   * namespace the word belongs to. This component used to run it through
   * `statLabel`, which looks a heading up by its own English slugged: fed
   * a label that had already been translated it asked for `aucun` and
   * `score-de-l-quipe`, keys no catalogue can hold, and logged a miss for
   * every segment on the page in every language but English.
   */
  label: string;
  href?: string;
  /** Optional tally after the label, so the scope difference reads before the
   * click rather than after it. */
  count?: number;
  /** Optional picture before the label, when the choice has one the game
   * already draws (a crew seat's badge). */
  icon?: ReactNode;
};

/**
 * The site's segmented switch: a row of mutually exclusive choices in one
 * bordered box, the active one filled.
 *
 * No directive, on purpose. Rendered from a server component (the language
 * boards, whose segments are links) it stays on the server; imported by a
 * client component (the sessions tab, whose segments are state) it is bundled
 * with it. Only the caller passing a handler needs to be a client component.
 */
export function SegmentedControl<T extends string>({
  segments,
  active,
  onSelect,
  className,
}: {
  segments: Segment<T>[];
  active: T;
  onSelect?: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-fd-border bg-fd-card p-0.5 text-xs font-medium",
        className,
      )}
    >
      {segments.map((segment) => {
        const content = (
          <>
            {segment.icon}
            <span>{segment.label}</span>
            {segment.count === undefined ? null : (
              <span className="text-fd-muted-foreground/70">
                {segment.count}
              </span>
            )}
          </>
        );
        const classes = cn(
          "inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors",
          segment.id === active
            ? "bg-brand/15 text-fd-foreground"
            : "text-fd-muted-foreground hover:text-fd-foreground",
        );
        return segment.href ? (
          <Link key={segment.id} href={segment.href} className={classes}>
            {content}
          </Link>
        ) : (
          <button
            key={segment.id}
            type="button"
            onClick={() => onSelect?.(segment.id)}
            className={cn(classes, "cursor-pointer")}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
