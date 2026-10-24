import { isConfidentSample, type TankLoadoutStats } from "@unicum.gg/shared";
import { Interpolate } from "@/components/interpolate";
import Link from "@/components/link";
import { RelativeTime } from "@/components/relative-time";
import ROUTES from "@/constants/routes";
import { numberFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";

/**
 * Who these figures come from, said before any of them is shown.
 *
 * This is the first thing on the tab on purpose. Every percentage below it is
 * counted from players who installed something to make it exist, there are not
 * many of them yet, and a reader who does not know that will read a third as a
 * third of the server. So the sample is stated in plain words at the top, and
 * again beside each row as a count whenever it is small.
 *
 * It names the mod too, which is not promotion for its own sake: the figures
 * get better only as more people share, so the page that shows them is the one
 * place where saying so is useful rather than noise.
 */
export async function SampleNote({
  stats,
  modeName,
  locale,
}: {
  stats: Pick<TankLoadoutStats, "sample" | "battles" | "updatedAt">;
  /** The battle mode these figures are counted in, in the game's own words. */
  modeName: string;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/tanks/detail/loadouts/sample-note",
    locale,
  );
  const integer = numberFormat(locale, { maximumFractionDigits: 0 });
  const confident = isConfidentSample(stats.sample);

  return (
    <div className="space-y-1.5 text-sm text-fd-muted-foreground">
      <p>
        <Interpolate
          template={t("counted-from")}
          values={{
            battles: (
              <span key="b" className="font-medium text-fd-foreground">
                {integer.format(stats.battles)}
              </span>
            ),
            mode: (
              <span key="m" className="font-medium text-fd-foreground">
                {modeName}
              </span>
            ),
            players: (
              <span key="p" className="font-medium text-fd-foreground">
                {integer.format(stats.sample)}
              </span>
            ),
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

      {/* Said once, at the top, rather than as a warning icon on every row.
          A small sample is a property of the whole tab, and the rows below
          already lead with their own counts rather than with a percentage. */}
      <p>
        {confident ? null : <>{t("small-sample")} </>}
        {t("correlation")}
      </p>
    </div>
  );
}
