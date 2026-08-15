"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";

export type OnslaughtSeasonRef = {
  key: string;
  label: string;
  available: boolean;
  eventId: string | null;
};

/**
 * Season picker for the Onslaught board header. Lists the game's full season
 * history: the seasons we hold are selectable, the rest render disabled (which
 * is the point — it shows the board knows every season, not just the ones we
 * captured). Navigates to `?season=<id>` (or the clean path for the newest
 * available season), so the whole page re-renders on the chosen season.
 */
export function OnslaughtSeasonSelect({
  seasons,
  current,
  region,
}: {
  seasons: OnslaughtSeasonRef[];
  current: string | null;
  region: Region;
}) {
  const router = useRouter();
  if (seasons.length === 0) return null;

  const latest = seasons.find((s) => s.available)?.eventId ?? null;
  const onChange = (eventId: string) => {
    const base = ROUTES.PLAYERS_ONSLAUGHT(region);
    router.push(
      eventId === latest
        ? base
        : `${base}?season=${encodeURIComponent(eventId)}`,
    );
  };

  return (
    <Select value={current ?? latest ?? undefined} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="h-8 w-56 bg-transparent text-xs dark:bg-transparent"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {seasons.map((s) => (
          <SelectItem
            key={s.key}
            value={s.eventId ?? s.key}
            disabled={!s.available}
          >
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
