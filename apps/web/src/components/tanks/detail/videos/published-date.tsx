import { format } from "date-fns";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * When a video went up, as `<time>` so the machine-readable date rides along
 * even where the text is shortened.
 *
 * Absolute rather than relative on purpose: `RelativeTime` reads the clock on
 * the client, so a server-rendered page, the `.md` twin it is converted into
 * and a crawler all see "just now" for a video published last month. A
 * publication date is not read as "24 days ago" anyway: it is when the
 * recording came out.
 *
 * Formatted by date-fns rather than `Intl`, which resolves against whatever ICU
 * data the environment ships: the server and the browser can disagree, and this
 * is rendered on both.
 */
export function PublishedDate({
  date,
  className,
  ...props
}: { date: Date | string } & Omit<ComponentProps<"time">, "dateTime">) {
  const value = typeof date === "string" ? new Date(date) : date;
  return (
    <time
      dateTime={value.toISOString()}
      className={cn("whitespace-nowrap", className)}
      {...props}
    >
      {format(value, "MMM d, yyyy")}
    </time>
  );
}
