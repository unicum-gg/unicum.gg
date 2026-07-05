"use client";

import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The Overall / last-30-days axis shared by the "Top players" and "Top clans"
 * panels. Its own enum (a client module with no server deps) rather than the
 * DB-heavy `TopPlayersPeriod` / `TopClansPeriod`, which must not reach the
 * browser bundle. Values match those enums so the same cookie string drives
 * both server fetch and client toggle.
 */
export enum LeaderboardPeriod {
  Overall = "overall",
  Month = "30d",
}

const PERIOD_LABEL: Record<LeaderboardPeriod, string> = {
  [LeaderboardPeriod.Overall]: "Overall",
  [LeaderboardPeriod.Month]: "Past 30 days",
};

function isLeaderboardPeriod(v: string): v is LeaderboardPeriod {
  return v === LeaderboardPeriod.Overall || v === LeaderboardPeriod.Month;
}

/**
 * Cookie-backed period, shared across every panel that reads it. Writing from
 * one panel's select broadcasts to the others (via `useCookie`), so "Top
 * players" and "Top clans" stay in sync and the choice survives reloads, the
 * same way the rating metric does.
 */
export function useLeaderboardPeriod(): [
  LeaderboardPeriod,
  (next: LeaderboardPeriod) => void,
] {
  const [stored, setStored] = useCookie(
    STORAGE.COOKIES.PERIOD,
    LeaderboardPeriod.Overall,
  );
  const period = isLeaderboardPeriod(stored)
    ? stored
    : LeaderboardPeriod.Overall;
  return [period, setStored];
}

/**
 * The inline period select rendered in a panel title. Presentational: the
 * owning panel holds the cookie-backed value (via `useLeaderboardPeriod`) so it
 * can pick the right dataset and toggle the "See all" link. Styled to blend
 * into the `text-xl font-semibold` title, with a negative margin so it does not
 * grow the header line box.
 */
export function LeaderboardPeriodSelect({
  period,
  onChange,
}: {
  period: LeaderboardPeriod;
  onChange: (next: LeaderboardPeriod) => void;
}) {
  return (
    <Select
      value={period}
      onValueChange={(v) => {
        if (isLeaderboardPeriod(v)) onChange(v);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Leaderboard period"
        className="-my-1 inline-flex! h-7! gap-1 px-1.5! py-0! align-middle text-xl! font-semibold [&_svg]:size-4"
      >
        <SelectValue>{PERIOD_LABEL[period]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.values(LeaderboardPeriod).map((p) => (
          <SelectItem key={p} value={p}>
            {PERIOD_LABEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
