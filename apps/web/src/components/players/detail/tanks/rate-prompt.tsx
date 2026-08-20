"use client";

import Link from "next/link";
import useSWR from "swr";
import { MIN_BATTLES_TO_RATE } from "@unicum.gg/shared";
import type { PlayerTankRow } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { NationFlag } from "@/components/tanks/nation-flag";
import ROUTES from "@/constants/routes";
import { useSession } from "@/lib/auth-client";
import { unicum } from "@/services/sdk";

const intFmt = new Intl.NumberFormat("en-US");

/**
 * "You have four thousand battles in this one. What do you make of it?"
 *
 * The whole community rating rests on votes from people who have played the
 * tank, which is a strength and a distribution problem at once: the players who
 * qualify are exactly the ones who never think to go looking for a rating form.
 * This is where they are found. A player looking at their own garage is one
 * click from the vehicles they know best, and the only ones offered are ones
 * they have the battles for and have not already judged.
 *
 * Shown on nobody else's profile. Somebody else's garage is not a list of tanks
 * you can rate, and asking would be asking them to lie.
 */
export function RateYourTanksPrompt({
  region,
  nickname,
  vehicles,
}: {
  region: Region;
  nickname: string;
  vehicles: PlayerTankRow[];
}) {
  const { data: session } = useSession();
  // The nickname is the check the page can make; the endpoint below only ever
  // returns the caller's own rows, so a wrong guess here shows a prompt rather
  // than leaking anything. WG nicknames are case-insensitive in practice.
  const isOwnProfile =
    session?.user?.name?.toLowerCase() === nickname.toLowerCase();

  const { data } = useSWR(
    isOwnProfile ? `ratings:mine:${region}` : null,
    () => unicum.region(region).ratingsMine(),
  );

  if (!isOwnProfile || !data) return null;

  const rated = new Set(data.ratings.map((r) => r.tankId));
  const candidates = vehicles
    .filter(
      (v) =>
        v.slug != null &&
        v.battles >= MIN_BATTLES_TO_RATE &&
        !rated.has(v.tankId),
    )
    // Most played first: the tanks someone has the most to say about, and the
    // ones whose verdict carries the most weight in the split.
    .sort((a, b) => b.battles - a.battles)
    .slice(0, SUGGESTIONS);

  if (candidates.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-b border-fd-border px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium">Rate the tanks you play</p>
        <Link
          href={ROUTES.TANKS_COMMUNITY(region)}
          className="text-xs text-fd-muted-foreground underline-offset-4 hover:underline"
        >
          See what everyone thinks
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {candidates.map((tank) => (
          <Link
            key={tank.tankId}
            href={`${ROUTES.TANK(region, tank.slug as string)}/community`}
            className="flex items-center gap-2 rounded-md border border-fd-border px-2.5 py-1.5 text-xs transition-colors hover:bg-fd-secondary/40"
          >
            {tank.nation ? (
              <NationFlag
                nation={tank.nation}
                region={region}
                variant="flag"
              />
            ) : null}
            <span>{tank.shortName ?? tank.name}</span>
            <span className="text-fd-muted-foreground tabular-nums">
              {intFmt.format(tank.battles)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Enough to feel like a suggestion, few enough that it stays a nudge rather
 * than a chore list on top of somebody's garage. */
const SUGGESTIONS = 6;
