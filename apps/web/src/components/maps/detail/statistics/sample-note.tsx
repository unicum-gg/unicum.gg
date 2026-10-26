import type { MapStatistics } from "@unicum.gg/shared";
import { Interpolate } from "@/components/interpolate";
import Link from "@/components/link";
import { RelativeTime } from "@/components/relative-time";
import ROUTES from "@/constants/routes";
import { numberFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";

/**
 * Who these figures come from, said before any of them is shown.
 *
 * The Loadouts tab's note, for the same reason it is first there: every figure
 * below exists because players chose to share their battles, there are not
 * many of them yet, and a reader who does not know that reads a percentage as
 * the whole server's. It states both units, battles and vehicle records, since
 * the blocks below are counted over one or the other and the gap between them
 * is thirty to one.
 */
export async function MapSampleNote({
  stats,
  modeName,
  locale,
}: {
  stats: Pick<MapStatistics, "battles" | "records" | "players" | "updatedAt">;
  /** The battle mode these figures are counted in, in the game's own words. */
  modeName: string;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/maps/detail/statistics/sample-note",
    locale,
  );
  const integer = numberFormat(locale, { maximumFractionDigits: 0 });
  const strong = (key: string, value: React.ReactNode) => (
    <span key={key} className="font-medium text-fd-foreground">
      {value}
    </span>
  );

  return (
    <div className="space-y-1.5 text-sm text-fd-muted-foreground">
      <p>
        <Interpolate
          template={t("counted-from")}
          values={{
            battles: strong("b", integer.format(stats.battles)),
            mode: strong("m", modeName),
            records: strong("r", integer.format(stats.records)),
            players: strong("p", integer.format(stats.players)),
            mod: (
              <Link key="mod" href={ROUTES.MOD} className="underline">
                {t("the-mod")}
              </Link>
            ),
          }}
        />
        {stats.updatedAt ? (
          <>
            {" "}
            <RelativeTime date={stats.updatedAt} />
          </>
        ) : null}
        .
      </p>
      <p>{t("against-everywhere")}</p>
    </div>
  );
}
