"use client";

import { format, isSameDay } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowSquareOutIcon, StarIcon } from "@phosphor-icons/react";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { RelativeTime } from "@/components/relative-time";
import { tierLabel } from "@/components/tournaments/tier-label";
import ROUTES from "@/constants/routes";
import { useNow } from "@/hooks/use-now";
import { usePassed } from "@/hooks/use-passed";
import { TOURNAMENT_GAME_MODE_LABEL, teamFormat } from "@unicum.gg/shared";
import {
  REGION_WOT_HOST,
  TournamentStatus,
  type Region,
} from "@unicum.gg/wargaming";
import type { TournamentListRow } from "./board";

/** How far ahead the strip looks. Tournaments run on a fixed daily timetable, so
 * three days answers "what is on soon" without becoming a second catalogue. */
const DAYS = 3;

function dayLabel(day: Date, today: Date): string {
  if (isSameDay(day, today)) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(day, tomorrow)) return "Tomorrow";
  return format(day, "EEEE d MMM");
}

/**
 * One slot on the timetable.
 *
 * The organiser's title repeats what the card already shows ("2v2 Tier VI -
 * 17:00 CEST - N°25" beside a 17:00 heading and a 2v2 label), so the card is
 * built from the FIELDS instead and the title stays on hover. What is left is
 * the four things that decide whether you play: when, what format, which tier,
 * and how long you have left to enter.
 */
function Slot({ region, row }: { region: Region; row: TournamentListRow }) {
  const tier = tierLabel(row.tierFrom, row.tierTo);
  const mode = row.gameModes.map((m) => TOURNAMENT_GAME_MODE_LABEL[m]).join(", ");
  // The date beats the status: Wargaming leaves a tournament reading
  // "registration open" for a while after its own deadline passed.
  const closed = usePassed(row.registrationTill);
  const canEnter =
    row.status === TournamentStatus.RegistrationStarted && !closed;

  return (
    // A container, not a link: the card holds a Register button, and an anchor
    // inside an anchor is invalid and unclickable. The detail link covers the
    // information instead, and the button is its sibling.
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-fd-border p-3 transition-colors hover:border-fd-ring">
      <Link
        href={ROUTES.TOURNAMENT(region, row.id)}
        title={row.title}
        className="flex min-w-0 flex-col gap-1"
      >
        <span className="flex items-center gap-1.5">
          {row.logoUrl?.startsWith("http") && (
            <Image
              src={row.logoUrl}
              alt=""
              width={40}
              height={40}
              className="size-5 shrink-0 object-contain"
            />
          )}
          <time
            dateTime={row.startAt.toISOString()}
            className="font-heading text-xl font-bold tabular-nums"
          >
            {format(row.startAt, "HH:mm")}
          </time>
          {row.isFeatured && (
            <StarIcon
              weight="fill"
              className="size-3.5 text-amber-500"
              aria-label="Featured"
            />
          )}
        </span>
        <span className="truncate text-sm font-medium">
          {teamFormat(row.minPlayersInTeam)}
          {tier && <span className="text-fd-muted-foreground"> · {tier}</span>}
        </span>
        <span className="truncate text-xs text-fd-muted-foreground">
          {mode || row.title}
        </span>
        {row.registrationTill && (
          <span className="text-xs text-fd-muted-foreground">
            {closed ? (
              "Registration closed"
            ) : (
              <>
                Closes <RelativeTime date={row.registrationTill} />
              </>
            )}
          </span>
        )}
      </Link>
      {/* Entering only happens on Wargaming's site, so the card carries the way
          there rather than making a reader open the tournament to find it. */}
      {canEnter && (
        <Button
          asChild
          size="sm"
          className="mt-1 w-full bg-brand text-white hover:bg-brand/90"
        >
          <a
            href={`https://${REGION_WOT_HOST[region]}/en/tournaments/${row.id}/registration/`}
            target="_blank"
            rel="nofollow noopener noreferrer"
          >
            Register
            <ArrowSquareOutIcon weight="bold" className="size-3.5" />
          </a>
        </Button>
      )}
    </div>
  );
}

/**
 * What is on today and next, as a timetable rather than a list.
 *
 * The catalogue answers "what exists"; this answers the question the page gets
 * opened with, which is "what can I still play tonight". They run on a fixed
 * daily schedule, so the useful shape is a clock.
 *
 * Client-only, because a `force-static` page cannot know what "today" is: the
 * server would bake its own date into HTML served hours later, and a wrong
 * "Today" is worse than a beat of delay.
 */
export function TournamentSchedule({
  region,
  rows,
}: {
  region: Region;
  rows: TournamentListRow[];
}) {
  // Zero until the client has a clock, which is what keeps "Today" honest on a
  // statically rendered page.
  const nowMs = useNow();
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const upcoming = useMemo(() => {
    if (nowMs === 0) return [];
    const now = new Date(nowMs);
    const horizon = new Date(nowMs);
    horizon.setDate(horizon.getDate() + DAYS);
    return rows
      .filter((r) => r.startAt > now && r.startAt <= horizon)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }, [rows, nowMs]);

  const hasFeatured = upcoming.some((r) => r.isFeatured);
  const days = useMemo(() => {
    const shown = featuredOnly ? upcoming.filter((r) => r.isFeatured) : upcoming;
    const byDay = new Map<string, TournamentListRow[]>();
    for (const row of shown) {
      const key = format(row.startAt, "yyyy-MM-dd");
      byDay.set(key, [...(byDay.get(key) ?? []), row]);
    }
    const today = new Date(nowMs);
    return [...byDay.entries()].map(([key, list]) => ({
      key,
      label: dayLabel(list[0]!.startAt, today),
      list,
    }));
  }, [upcoming, featuredOnly, nowMs]);

  // Nothing scheduled ahead is a real answer, and an empty panel would read as a
  // section that failed to load.
  if (upcoming.length === 0) return null;

  return (
    // Carries its own separator: it decides at runtime whether it has anything
    // to show, and a separator left behind reads as a failed section.
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader
          screenLines={false}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-fd-border"
        >
          <PanelTitle>Coming up</PanelTitle>
          <span className="flex items-center gap-3">
            {/* The same cut the catalogue below offers, kept here because a
                reader watching the schedule wants it more, not less. */}
            {hasFeatured && (
              <ChipRow>
                <Chip
                  active={featuredOnly}
                  onClick={() => setFeaturedOnly(!featuredOnly)}
                >
                  <StarIcon
                    weight={featuredOnly ? "fill" : "regular"}
                    className="size-3.5"
                  />
                  Featured
                </Chip>
              </ChipRow>
            )}
            <span className="text-xs text-fd-muted-foreground">
              Times in your own time zone
            </span>
          </span>
        </PanelHeader>
        <PanelContent className="flex flex-col gap-4 p-4">
          {days.map((day) => (
            <div key={day.key} className="flex flex-col gap-2">
              <span className="text-xs tracking-wide text-fd-muted-foreground uppercase">
                {day.label}
              </span>
              {/* Capped at four across: `auto-fill` filled a wide screen with
                  six narrow cards, which made a four-tournament evening read as
                  a strip of chips rather than a timetable. */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {day.list.map((row) => (
                  <Slot key={row.id} region={region} row={row} />
                ))}
              </div>
            </div>
          ))}
        </PanelContent>
      </Panel>
    </>
  );
}
