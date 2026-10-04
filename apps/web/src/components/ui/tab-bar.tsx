import type { ReactNode } from "react";

import { ScrollRail } from "@/components/scroll-rail";
import { cn } from "@/lib/utils";

/**
 * The site's tab bar: a row of whole pages that scrolls rather than wraps, and
 * says so with the rail's arrow.
 *
 * It was fifteen copies of one `<nav className="flex items-center
 * overflow-x-auto text-sm">`, every one of them with a native scrollbar, which
 * is what a reader is told nothing by: the overlay bar appears only once you
 * are already scrolling, and on Windows the permanent one is drawn as a grey
 * bar straight through the row. `ChipRow` already said it scrolled "like the
 * tab bars", which is the shape this is, a rail wrapping the nav rather than
 * the nav being the scroller.
 *
 * `w-max` on the nav rather than a flex box on the rail: a flex item shrinks to
 * its min-content, which on a row of `whitespace-nowrap` tabs would be the
 * widest of them rather than all of them, and the row would stop scrolling.
 */
export function TabBar({
  children,
  className,
}: {
  children: ReactNode;
  /** Classes for the positioned wrapper, which is what the parent lays out. */
  className?: string;
}) {
  return (
    <ScrollRail containerClassName={className} className="text-sm">
      <nav className="flex w-max items-center">{children}</nav>
    </ScrollRail>
  );
}

/** What a tab is: the three differ only in whether they answer a pointer. */
export enum TabKind {
  /** An anchor, which already carries its own cursor. */
  Link = "link",
  /** A button, which under Tailwind's reset does not. */
  Button = "button",
  /** A skeleton's placeholder: it looks like a tab and answers nothing, so it
   * must not light up under the pointer either. */
  Inert = "inert",
}

/** The class a tab wears, active or not. */
export function tabItemClass(
  active: boolean,
  kind: TabKind = TabKind.Link,
): string {
  const inert = kind === TabKind.Inert;
  return cn(
    "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap",
    kind === TabKind.Button && "cursor-pointer",
    !inert && "transition-colors",
    active
      ? "bg-fd-secondary/40 text-fd-foreground"
      : cn(
          "text-fd-muted-foreground",
          !inert && "hover:bg-fd-secondary/20 hover:text-fd-foreground",
        ),
  );
}
