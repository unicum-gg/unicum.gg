"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The one look every control on the picture shares.
 *
 * **A mark, not a box.** It carries no border and no ground of its own: the
 * group it sits in does. Given one each, a row of them is a row of rectangles
 * with nothing to say about which belong together, which is what the band under
 * this picture was.
 */
export const CONTROL =
  "rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-secondary/60 hover:text-fd-foreground aria-pressed:text-brand";

/**
 * One family of controls, boxed together.
 *
 * **The grouping is the whole point.** Everything here was one flat row, so a
 * control for the camera sat beside a field for a shell's normalisation as
 * though the two were the same kind of question, and the row was wide enough to
 * wrap onto a second line and push the legend up over the tank. Boxed by what
 * they are about, the band reads as four short answers rather than one long
 * one, and a reader looking for the paint knows which box to look in.
 */
export function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-fd-border/60 bg-fd-background/70 p-1 backdrop-blur">
      {children}
    </div>
  );
}

/** One mark in a group: the button, its state, and the words behind it. */
export function Mark({
  on,
  onClick,
  says,
  tooltip,
  wide,
  children,
}: {
  on?: boolean;
  onClick: () => void;
  /** What it is, read out and shown when there is nothing longer to say. */
  says: string;
  /** The longer form, where the state deserves a sentence. */
  tooltip?: string;
  /** Whether it carries a figure beside its icon. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={says}
          {...(on === undefined ? {} : { "aria-pressed": on })}
          className={`${CONTROL} ${wide ? "flex items-center gap-1" : ""}`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip ?? says}</TooltipContent>
    </Tooltip>
  );
}
