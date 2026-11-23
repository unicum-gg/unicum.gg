import type { PodiumClan } from "@/app/api/support/podium/schema.api";
import { ClanTag } from "@/components/entity/clan-tag";
import Link from "@/components/link";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";

/** A board row as the SDK hands it over: `region` widened to a string, for the
 * reason `PodiumRow` in `./podium` explains. */
type ClanRow = Omit<PodiumClan, "region"> & { region: string };

/**
 * The clans board under the supporters podium: clans ranked by what their
 * current members have given and counted for them. A plain ranked list rather
 * than a second podium, since its point is the competition between clans and
 * not a ceremony for the first three. Amounts are never shown, like the
 * podium's.
 */
export function ClansBoard({
  clans,
  supportersLabel,
}: {
  clans: ClanRow[];
  /** Renders "N supporters" for a row, already translated by the server parent. */
  supportersLabel: (count: number) => string;
}) {
  return (
    <ol className="divide-y divide-fd-border rounded-md border border-fd-border">
      {clans.map((clan) => (
        <li
          key={`${clan.region}-${clan.id}`}
          className="flex items-center gap-3 px-3 py-2 text-sm"
        >
          <span className="w-6 shrink-0 text-right font-semibold tabular-nums text-fd-muted-foreground">
            {clan.rank}
          </span>
          <Link
            href={ROUTES.CLAN(clan.region as Region, clan.tag)}
            prefetch="intent"
            className="min-w-0 truncate hover:text-brand hover:underline underline-offset-2"
          >
            <ClanTag tag={clan.tag} color={clan.color} className="font-mono font-semibold" />
          </Link>
          <span className="text-xs uppercase text-fd-muted-foreground">
            {clan.region}
          </span>
          <span className="ml-auto shrink-0 text-xs text-fd-muted-foreground">
            {supportersLabel(clan.supporters)}
          </span>
        </li>
      ))}
    </ol>
  );
}
