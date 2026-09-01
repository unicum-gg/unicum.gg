"use client";

import {
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * How much hidden content is worth an arrow.
 *
 * Sub-pixel rounding and a padding of a few pixels routinely leave a box whose
 * scroll size is a hair over its client size with nothing actually hidden, and
 * at a 4px tolerance those offered an arrow that scrolled by half a word. A
 * dozen pixels is under anything we would want to reveal, so nothing real is
 * missed.
 */
const MIN_SCROLL = 12;

/**
 * A scroller with round arrow buttons, shown only on the side that can still
 * scroll, and with the native scrollbar hidden.
 *
 * Lifted out of the tank page's research branch, which is where the pattern was
 * settled: a row that will not fit is not a row to wrap. Wrapping doubles the
 * height of whatever holds it and pushes the rest of the page down, and in a
 * header it moves the content a reader is looking at. The arrow is what says
 * there is more, since a hidden scrollbar says nothing at all, and hiding it is
 * the point on Windows, where the native one is drawn as a permanent grey bar
 * through the content.
 */
export function ScrollRail({
  children,
  className,
  containerClassName,
  compact,
  axis = "x",
  backButtonClassName,
  stickyButtons,
}: {
  children: ReactNode;
  /** Classes for the scrolling box itself (padding, alignment, height). */
  className?: string;
  /** Classes for the positioned wrapper, which is what the parent lays out:
   * the arrows are absolute against it, so anything sizing the rail (`flex-1`,
   * `absolute inset-0`) belongs here rather than on the box inside it. */
  containerClassName?: string;
  /** Smaller arrows, for a rail that is one line of text tall: the default
   * button is as tall as a header's whole meta row. */
  compact?: boolean;
  /** Which way it scrolls. Vertical puts the arrows at the top and bottom
   * edges, centred. */
  axis?: "x" | "y";
  /** Overrides where the backwards arrow (up / left) sits. For a list with a
   * sticky header, which the arrow would otherwise cover. */
  backButtonClassName?: string;
  /**
   * Keep the arrows in view down a rail taller than the window.
   *
   * Centred on the rail's own height, an arrow on a 3,000px bracket sits a
   * screen and a half below where the reader is looking, which is the same as
   * not having one. Sticky, it rides the page scroll and stays beside whatever
   * part of the draw is on screen.
   */
  stickyButtons?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);
  const vertical = axis === "y";

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const offset = vertical ? el.scrollTop : el.scrollLeft;
    const client = vertical ? el.clientHeight : el.clientWidth;
    const total = vertical ? el.scrollHeight : el.scrollWidth;
    setCanBack(offset > MIN_SCROLL);
    setCanForward(offset + client < total - MIN_SCROLL);
  }, [vertical]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    // The content can change size without the element resizing (a longer
    // tournament title, a streamer going live), so both are watched.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const step = (vertical ? el.clientHeight : el.clientWidth) * 0.75;
    el.scrollBy({ [vertical ? "top" : "left"]: dir * step, behavior: "smooth" });
  };

  return (
    // A flex box, so the scrolling child stretches to the size its parent gives
    // the rail instead of collapsing onto its own content. The clan and player
    // meta rows are a fixed-height strip whose vertical centring comes from that
    // stretch, and a block wrapper left the line stuck to the top.
    <div
      className={cn(
        "relative flex",
        vertical ? "min-h-0 flex-col" : "min-w-0",
        containerClassName,
      )}
    >
      <div
        ref={ref}
        className={cn(
          "flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          vertical ? "min-h-0 overflow-y-auto" : "min-w-0 overflow-x-auto",
          className,
        )}
      >
        {children}
      </div>
      {canBack && (
        <RailButton
          side={vertical ? "up" : "left"}
          compact={compact}
          sticky={stickyButtons}
          className={backButtonClassName}
          onClick={() => scroll(-1)}
        />
      )}
      {canForward && (
        <RailButton
          side={vertical ? "down" : "right"}
          compact={compact}
          sticky={stickyButtons}
          onClick={() => scroll(1)}
        />
      )}
    </div>
  );
}

const ICONS = {
  left: CaretLeftIcon,
  right: CaretRightIcon,
  up: CaretUpIcon,
  down: CaretDownIcon,
};

const LABELS = {
  left: "Scroll left",
  right: "Scroll right",
  up: "Scroll up",
  down: "Scroll down",
};

// Always inset from the edge it sits on: a rail ends where something else
// begins (a header's flags, the panel frame, the row under the list), and a
// button flush against that reads as part of it rather than as a control over
// the rail. Scaled with the button, so the gap stays proportionate.
const PLACE: Record<
  keyof typeof ICONS,
  { align: string; near: string; far: string }
> = {
  left: { align: "top-1/2 -translate-y-1/2", near: "left-1", far: "left-2" },
  right: { align: "top-1/2 -translate-y-1/2", near: "right-1", far: "right-2" },
  up: { align: "left-1/2 -translate-x-1/2", near: "top-1", far: "top-2" },
  down: { align: "left-1/2 -translate-x-1/2", near: "bottom-1", far: "bottom-2" },
};

function RailButton({
  side,
  compact,
  sticky,
  className,
  onClick,
}: {
  side: keyof typeof ICONS;
  compact?: boolean;
  sticky?: boolean;
  className?: string;
  onClick: () => void;
}) {
  const Icon = ICONS[side];
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={LABELS[side]}
      className={cn(
        // Hovers like every other icon button on the site: the surface fills,
        // rather than the outline brightening, which barely read at all over a
        // busy row. The translucent ground plus the blur is what keeps it
        // legible over the content it covers.
        "absolute z-10 flex cursor-pointer items-center justify-center rounded-full border border-fd-border bg-fd-background/90 text-fd-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-fd-secondary hover:text-fd-foreground focus-visible:outline-none",
        compact ? "size-5" : "size-8",
        sticky
          ? "pointer-events-auto sticky top-[50vh] mx-2 -translate-y-1/2"
          : cn(PLACE[side].align, compact ? PLACE[side].near : PLACE[side].far),
        className,
      )}
    >
      <Icon className={compact ? "size-3" : "size-4"} weight="bold" />
    </button>
  );
  if (!sticky) return button;
  // A full-height lane the button sticks inside: `position: sticky` needs a
  // block that scrolls past it, and the absolutely-positioned button is not one.
  // The lane is inert so it never eats a click meant for the content under it.
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 z-10 flex items-start",
        side === "left" ? "left-0" : "right-0",
      )}
    >
      {button}
    </div>
  );
}
