"use client";

import { forwardRef, type ReactNode } from "react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

// A segmented row of pills: the site's filter control, used by the tank and
// map galleries, the leaderboards and the glossary index. A primitive rather
// than part of any one of them, which is also where the Radix import belongs.

export function ChipRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-fit max-w-full overflow-x-auto rounded-md border border-fd-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const Chip = forwardRef<
  HTMLButtonElement,
  { active: boolean; asChild?: boolean } & React.ComponentProps<"button">
>(({ active, asChild, className, children, ...props }, ref) => {
  // A chip that navigates rather than toggles renders as whatever it wraps (a
  // link), so a filter can be a real URL where that is the better page.
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      {...(asChild ? {} : { type: "button" as const })}
      {...props}
      className={cn(
        // `inline-flex`, not the button's default block box: the preflight
        // sets `svg { display: block }`, so a chip carrying an icon (the
        // Featured star) stacked it above its own label and grew taller than
        // every chip beside it. Text-only chips are unaffected.
        "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap border-r border-fd-border px-3 py-1.5 font-medium transition-colors last:border-r-0",
        active
          ? "bg-fd-secondary/50 text-fd-foreground"
          : "text-fd-muted-foreground hover:bg-fd-secondary/25 hover:text-fd-foreground",
        className,
      )}
    >
      {children}
    </Comp>
  );
});
Chip.displayName = "Chip";
