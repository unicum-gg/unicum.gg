import type { ReactNode } from "react";

import { ScrollRail } from "@/components/scroll-rail";
import { cn } from "@/lib/utils";

/**
 * The bar of tabs a section is navigated with, on every page that carries one.
 *
 * The row scrolls rather than wraps, since a second line doubles the height of
 * the header and pushes down the content the reader came for. What says there
 * is more of it is the rail's arrow rather than the native scrollbar: on
 * Windows that one is drawn as a permanent grey bar through the tabs, and
 * everywhere it is hidden it says nothing at all.
 */
export function TabNav({
  children,
  className,
}: {
  children: ReactNode;
  /** Classes for the `nav` itself, which is what the parent lays out. */
  className?: string;
}) {
  return (
    <nav className={cn("flex min-w-0", className)}>
      <ScrollRail
        containerClassName="flex-1"
        className="flex items-center text-sm"
      >
        {children}
      </ScrollRail>
    </nav>
  );
}

/**
 * The class of one tab, whatever element carries it: a link on the pages that
 * route per tab, a button on the ones switching client-side, a span on the
 * skeletons.
 *
 * `inert` is that last case, a tab standing in for a real one while the page
 * loads, so it answers no hover and offers no pointer.
 */
export function tabClass(
  active: boolean,
  options?: { inert?: boolean },
): string {
  return cn(
    "border-r border-fd-border px-4 py-3 font-medium whitespace-nowrap",
    options?.inert
      ? active
        ? "bg-fd-secondary/40 text-fd-foreground"
        : "text-fd-muted-foreground"
      : cn(
          "cursor-pointer transition-colors",
          active
            ? "bg-fd-secondary/40 text-fd-foreground"
            : "text-fd-muted-foreground hover:bg-fd-secondary/20 hover:text-fd-foreground",
        ),
  );
}
