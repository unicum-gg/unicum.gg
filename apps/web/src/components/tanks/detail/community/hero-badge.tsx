"use client";

import { useFormat } from "@/hooks/use-format";
import Link from "@/components/link";
import type { Region } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";
import { Stars, StarValue } from "./stars";
import { useTranslation } from "@/hooks/use-translation";

const INT_FORMAT = {} as const;

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
  const { num } = useFormat();
  const { t } = useTranslation("components/tanks/detail/community");
  const href = `${ROUTES.TANK(region, slug)}/community`;

  if (votes === 0 || overall == null) {
    return (
      <Link
        href={href}
        className="inline-flex w-fit items-center gap-1.5 text-xs text-fd-muted-foreground transition-colors hover:text-fd-foreground"
      >
        <Stars value={null} size={13} />
        <span>{t("not-rated")}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-2 transition-opacity hover:opacity-80"
      title={t("what-players-think")}
    >
      <StarValue value={overall} className="text-sm" />
      <Stars value={overall} size={13} />
      <span className="text-xs text-fd-muted-foreground tabular-nums">
        {t(votes === 1 ? "votes-one" : "votes", { count: num(INT_FORMAT).format(votes) })}
      </span>
    </Link>
  );
}
