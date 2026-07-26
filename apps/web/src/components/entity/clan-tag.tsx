import { cn } from "@/lib/utils";

/**
 * The colored `[TAG]` clan tag, the one bit of markup repeated wherever a clan
 * appears (leaderboards, player rows, headers, search, timelines). Only the
 * brackets take the clan color; the tag text inherits. Purely presentational:
 * callers wrap it in a link (`ROUTES.CLAN`) when the tag should navigate, since
 * it is often already nested inside a larger row link.
 *
 * Structural only, no default typography: it inherits its surroundings so it
 * reads identically to the inline markup it replaces. Callers pass the look
 * they want (`font-mono text-xs` next to a nickname, `font-mono font-semibold`
 * in clan lists, plain in a hero header).
 */
export function ClanTag({
  tag,
  color,
  name,
  className,
  nameClassName,
}: {
  tag: string;
  color: string | null;
  /** Full clan name rendered right after the tag, when the layout shows it. */
  name?: string;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={className}>
      <span style={{ color: color ?? undefined }}>[</span>
      {tag}
      <span style={{ color: color ?? undefined }}>]</span>
      {name ? <span className={cn("ml-1", nameClassName)}>{name}</span> : null}
    </span>
  );
}
