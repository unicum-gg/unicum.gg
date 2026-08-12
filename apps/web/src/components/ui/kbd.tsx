import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * A single key, drawn as a keycap.
 *
 * One key per element, so a combination is written as several: `⌘` then `K`,
 * rather than one element holding "⌘ K". That is what `<kbd>` means, it lets a
 * screen reader announce them separately, and it is the only way the spacing
 * stays right when a combination sits in a sentence.
 */
export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-fd-border bg-fd-muted px-1.5 align-middle font-mono text-[11px] leading-none font-medium text-fd-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
