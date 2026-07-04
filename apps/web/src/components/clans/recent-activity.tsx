import {
  ArrowFatDownIcon,
  ArrowFatUpIcon,
  MedalMilitaryIcon,
  SignInIcon,
  SignOutIcon,
} from "@phosphor-icons/react/dist/ssr";
import { format } from "date-fns";
import Link from "next/link";
import ROUTES from "@/constants/routes";
import {
  ClanEventType,
  type ClanRecentEvent,
} from "@/services/wargaming/wot/clans/event-types";
import type { Region } from "@unicum.gg/wargaming/region";

function prettyRole(role: string): string {
  if (!role) return "—";
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
}

function EventIcon({ event }: { event: ClanRecentEvent }) {
  switch (event.type) {
    case ClanEventType.JoinClan:
      return (
        <SignInIcon
          weight="fill"
          className="size-4 shrink-0 text-emerald-500"
        />
      );
    case ClanEventType.LeaveClan:
      return (
        <SignOutIcon
          weight="fill"
          className="size-4 shrink-0 text-rose-500"
        />
      );
    case ClanEventType.ChangeRole: {
      if (
        event.oldRank !== null &&
        event.newRank !== null &&
        event.newRank > event.oldRank
      ) {
        return (
          <ArrowFatUpIcon
            weight="fill"
            className="size-4 shrink-0 text-emerald-500"
          />
        );
      }
      if (
        event.oldRank !== null &&
        event.newRank !== null &&
        event.newRank < event.oldRank
      ) {
        return (
          <ArrowFatDownIcon
            weight="fill"
            className="size-4 shrink-0 text-rose-500"
          />
        );
      }
      return (
        <MedalMilitaryIcon
          weight="fill"
          className="size-4 shrink-0 text-amber-500"
        />
      );
    }
  }
}

function changeText(e: ClanRecentEvent): React.ReactNode {
  switch (e.type) {
    case ClanEventType.JoinClan:
      return <span className="text-foreground">Joined</span>;
    case ClanEventType.LeaveClan:
      return <span className="text-muted-foreground">Left</span>;
    case ClanEventType.ChangeRole:
      return (
        <span>
          <span className="text-muted-foreground">{prettyRole(e.oldRole ?? "")}</span>
          {" → "}
          <span className="text-foreground">{prettyRole(e.newRole ?? "")}</span>
        </span>
      );
  }
}

export function ClanRecentActivity({
  region,
  events,
}: {
  region: Region;
  events: ClanRecentEvent[];
}) {
  if (events.length === 0) return null;
  return (
    <ul className="divide-y divide-fd-border">
      {events.map((e, i) => (
        <li
          key={`${e.createdAt.getTime()}-${e.accountId}-${e.type}-${i}`}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
        >
          <EventIcon event={e} />
          <Link
            href={ROUTES.PLAYER(region, e.accountName)}
            className="font-medium hover:underline"
          >
            {e.accountName || `#${e.accountId}`}
          </Link>
          <span>{changeText(e)}</span>
          <span className="ms-auto text-xs text-muted-foreground tabular-nums">
            {format(e.createdAt, "MMM d, yyyy 'at' h:mm a")}
          </span>
        </li>
      ))}
    </ul>
  );
}
