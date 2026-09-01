"use client";

import type { ReactNode } from "react";
import { ScrollRail } from "@/components/scroll-rail";

/**
 * The research branch's horizontal scroller.
 *
 * The behaviour is the site's shared one; what is local is where it ends. The
 * rail sits in a padded panel, so scrolled to the end the branch stopped a full
 * 32px short of the frame (the panel's padding plus its own), which reads as a
 * rail that has more to show and will not show it. The scrolling row therefore
 * drops its right padding and bleeds through the panel's inset, so the last tank
 * runs to the border. The bleed is on the ROW and not on the wrapper: the arrows
 * are positioned against the wrapper, and widening that put them flat against
 * the frame. The left keeps its padding, since that is where the branch starts
 * rather than where it runs out.
 */
export function ResearchRail({ children }: { children: ReactNode }) {
  return (
    <ScrollRail className="-mr-4 flex items-start pl-4 pb-1">
      {children}
    </ScrollRail>
  );
}
