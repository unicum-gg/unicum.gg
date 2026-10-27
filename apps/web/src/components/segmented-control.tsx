"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "@/components/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  /**
   * Draw the icon alone, with the label as its tooltip and accessible name,
   * for a row of choices the game already pictures (vehicle classes) where
   * the words would crowd out everything around them.
   */
  iconOnly?: boolean;
  /** A longer sentence shown on hover, where the label alone says too little. */
  tooltip?: ReactNode;
  /** Shown but not pressable, while what it would show is still loading. */
  disabled?: boolean;
};

/**
 * The box around the segments, also the one the vehicle viewer groups its
 * controls in (`control-group`). No ground of its own, so it takes the
 * panel's: a box drawn over a picture (the viewer bands) adds its own
 * translucent one. `overflow-hidden` so the segments, which sit flush against
 * it, are clipped to its rounded corners.
 */
export const SEGMENTED_BOX =
  "inline-flex items-center overflow-hidden rounded-md border border-fd-border font-medium";

/**
 * One segment, pressed or not. Exported for the few switches that draw their
 * own buttons inside a box (a viewer band mixing views and icon marks), so
 * they still look like this one.
 */
export function segmentClass(active: boolean, compact = false): string {
  return cn(
    // A cell each, divided by a rule rather than spaced apart, and 26 pixels
    // so the box comes to the 28 of the filter inputs beside it.
    "inline-flex items-center gap-1.5 border-r border-fd-border leading-4 transition-colors last:border-r-0",
    compact ? "h-5 px-1.5 text-[0.6875rem]" : "h-[26px] px-3 text-xs",
    active
      ? "bg-fd-secondary/50 text-fd-foreground"
      : "text-fd-muted-foreground hover:bg-fd-secondary/25 hover:text-fd-foreground",
  );
}

/**
 * The site's one switch: a row of mutually exclusive choices in one box, the
 * chosen one filled, each in its own cell.
 *
 * **One, on purpose.** The site had grown a dozen of these, each a copy of the
 * last with its own padding, border and idea of "selected": a filled box here,
 * a ring there, a grey cell in a third. Side by side on one page they read as
 * different kinds of control when they are the same one, so there is this and
 * nothing else, and a caller that needs something it cannot do extends it
 * rather than drawing its own.
 *
 * Its height is the filter inputs' (`h-7`, 28 pixels with the box), and the
 * viewer bands match it, so a switch, a row of tools and a search field sit
 * on one line. `compact` is for a row of
 * small buttons, as on the comparison's column headers.
 */
type Box = { left: number; width: number };

/** Where one segment sits inside the control, for the gliding indicators. */
function boxOf(root: HTMLElement | null, id: string | null): Box | null {
  if (!root || id === null) return null;
  const el = root.querySelector<HTMLElement>(
    `[data-segment="${CSS.escape(id)}"]`,
  );
  return el ? { left: el.offsetLeft, width: el.offsetWidth } : null;
}

/** The two indicators that glide under the segments: the hovered one and the
 * chosen one. Drawn once and moved, rather than one background per segment
 * switched on and off, which is what makes the change read as motion. */
function Indicator({
  box,
  chosen,
}: {
  box: Box | null;
  chosen: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 transition-[left,width,opacity] duration-200 ease-out motion-reduce:transition-none",
        chosen ? "bg-fd-secondary/50" : "bg-fd-secondary/25",
        box ? "opacity-100" : "opacity-0",
      )}
      style={box ? { left: box.left, width: box.width } : undefined}
    />
  );
}

export function SegmentedControl<T extends string>({
  segments,
  active,
  onSelect,
  compact,
  className,
}: {
  segments: Segment<T>[];
  active: T;
  onSelect?: (id: T) => void;
  compact?: boolean;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [chosen, setChosen] = useState<Box | null>(null);
  const [hovered, setHovered] = useState<Box | null>(null);
  // Measured after layout and again whenever the control changes size (a
  // label translated longer, a font arriving late): until then each segment
  // draws its own state, so the server's HTML is right without JavaScript.
  const measure = useCallback(
    () => setChosen(boxOf(root.current, active)),
    [active],
  );
  useLayoutEffect(() => {
    measure();
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, segments.length]);
  const gliding = chosen !== null;

  const control = (
    <div
      ref={root}
      onMouseLeave={() => setHovered(null)}
      className={cn(
        SEGMENTED_BOX,
        "relative",
        className,
      )}
    >
      <Indicator box={hovered} chosen={false} />
      <Indicator box={chosen} chosen />
      {segments.map((segment) => {
        const on = segment.id === active;
        const content = (
          <>
            {segment.icon}
            {segment.iconOnly ? null : <span>{segment.label}</span>}
            {segment.count === undefined ? null : (
              <span className="text-fd-muted-foreground/70">
                {segment.count}
              </span>
            )}
          </>
        );
        const classes = cn(
          // Once the indicators are placed they carry the backgrounds, and a
          // segment only colours its text; before that it draws its own.
          gliding
            ? cn(
                segmentClass(false, compact),
                "relative z-10 hover:bg-transparent",
                on && "text-fd-foreground",
              )
            : segmentClass(on, compact),
          segment.disabled && "cursor-progress opacity-60",
        );
        const hover = {
          "data-segment": segment.id,
          onMouseEnter: (event: React.MouseEvent<HTMLElement>) =>
            setHovered({
              left: event.currentTarget.offsetLeft,
              width: event.currentTarget.offsetWidth,
            }),
        };
        const named = segment.iconOnly ? { "aria-label": segment.label } : {};
        const item = segment.href ? (
          <Link
            key={segment.id}
            href={segment.href}
            // A segment that is a link names a whole page, and Next would
            // otherwise prefetch every one of them on sight.
            prefetch="intent"
            aria-current={on ? "page" : undefined}
            className={classes}
            {...named}
            {...hover}
          >
            {content}
          </Link>
        ) : (
          <button
            key={segment.id}
            type="button"
            aria-pressed={on}
            disabled={segment.disabled}
            onClick={() => onSelect?.(segment.id)}
            className={cn(classes, "cursor-pointer")}
            {...named}
            {...hover}
          >
            {content}
          </button>
        );
        const tip = segment.tooltip ?? (segment.iconOnly ? segment.label : null);
        if (!tip) return item;
        return (
          <Tooltip key={segment.id}>
            <TooltipTrigger asChild>{item}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-none">
              {tip}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
  // A provider only where a segment has something to say on hover, so a plain
  // switch mounts nothing it does not use.
  return segments.some((segment) => segment.tooltip || segment.iconOnly) ? (
    <TooltipProvider>{control}</TooltipProvider>
  ) : (
    control
  );
}
