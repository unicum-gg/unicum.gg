"use client";

import { createElement, type ComponentProps, type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Elements a hint can draw itself, for the server-rendered case below. */
type HintTag = "span" | "div" | "td" | "p";

/**
 * What the browser's own `title` attribute was being used for, drawn by us.
 *
 * The native one is the wrong tool everywhere it was reached for here: it waits
 * about a second with no way to tune that, draws an operating-system box that
 * ignores the site entirely (white on every theme, a font nothing else uses),
 * truncates without saying so, and is the one piece of our interface a reader
 * cannot read on a phone. It is also invisible to a reviewer, since it only
 * exists while a pointer is held still.
 *
 * So this is the single wrapper every explanatory hover goes through, and the
 * rule is that `title` on an element a reader hovers is a bug. Two exceptions
 * remain and are deliberate: `<iframe title>` names a frame for assistive
 * technology rather than drawing anything, and an `aria-label` on an icon
 * button is what a screen reader announces, which a tooltip never replaces (it
 * only describes). Both stay beside a `Hint`, never instead of one.
 *
 * `content` may be absent, which is the common shape at the call sites this
 * replaced (`title={x ? format(x) : undefined}`). Nothing is rendered around
 * the child then, so a missing value costs no markup and no listener.
 *
 * **In a server component, pass `as` rather than an element.** The trigger is
 * `asChild`, which clones the child to put its handlers on it, and a child
 * built by a server component cannot be cloned across that boundary: it is
 * dropped, silently, and the only sign is a hydration mismatch naming the
 * element that vanished (measured: the servers page lost the first cell of
 * every row). Naming the tag instead has this file build it, on the client
 * side of the boundary, with `children` riding through as content rather than
 * as the thing being cloned.
 */
export function Hint({
  content,
  children,
  as,
  className,
  side,
  align,
  contentClassName,
  delayDuration = 150,
}: {
  content: ReactNode;
  children: ReactNode;
  /** The element to draw around `children`, for a caller that cannot hand over
   * a clonable one (see above). Omit it in a client component. */
  as?: HintTag;
  /** Classes for the element `as` draws. Meaningless without it. */
  className?: string;
  side?: ComponentProps<typeof TooltipContent>["side"];
  align?: ComponentProps<typeof TooltipContent>["align"];
  contentClassName?: string;
  /** Overridden only where a hover is the point of the element rather than an
   * aside, like a chart's own cells. */
  delayDuration?: number;
}) {
  if (content == null || content === "") {
    return as ? createElement(as, { className }, children) : <>{children}</>;
  }
  return (
    <Tooltip delayDuration={delayDuration}>
      {/* `asChild`: the trigger has to BE the element being described, or the
          hover target would be a wrapper of its own and the table cells would
          gain a layout box each. */}
      <TooltipTrigger asChild>
        {as ? createElement(as, { className }, children) : children}
      </TooltipTrigger>
      <TooltipContent side={side} align={align} className={contentClassName}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
