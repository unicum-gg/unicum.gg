import Link from "next/link";
import type { Region } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";
import { Stars, StarValue } from "./stars";

const intFmt = new Intl.NumberFormat("en-US");

/**
 * The community's verdict, in the hero, next to the tank's name.
 *
 * A feature nobody sees is a feature nobody uses, and the Community tab is the
 * sixth in a row of six. This is the discovery path: a score in the place a
 * reader is already looking, that says how many people stand behind it and
 * links to where they said it.
 *
 * An unrated tank gets an invitation rather than an empty score. That case is
 * the majority for a long while after launch, and rendering nothing there would
 * hide the feature from exactly the pages that need a first vote.
 */
export function CommunityHeroBadge({
  region,
  slug,
  overall,
  votes,
}: {
  region: Region;
  slug: string;
  overall: number | null;
  votes: number;
}) {
  const href = `${ROUTES.TANK(region, slug)}/community`;

  if (votes === 0 || overall == null) {
    return (
      <Link
        href={href}
        className="inline-flex w-fit items-center gap-1.5 text-xs text-fd-muted-foreground transition-colors hover:text-fd-foreground"
      >
        <Stars value={null} size={13} />
        <span>Not rated yet, be the first</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-2 transition-opacity hover:opacity-80"
      title="What players think of this tank"
    >
      <StarValue value={overall} className="text-sm" />
      <Stars value={overall} size={13} />
      <span className="text-xs text-fd-muted-foreground tabular-nums">
        {intFmt.format(votes)} {votes === 1 ? "vote" : "votes"}
      </span>
    </Link>
  );
}
