import { numberFormat } from "@/lib/format";
import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import { JsonLd } from "@/components/json-ld";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { itemListSchema } from "@/lib/schema-org";
import { buildSafe, unicum } from "@/services/sdk";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";
import { CommunityBoard } from "./board";
import { Extremes } from "./extremes";
import type { CommunityBoardRow } from "./row";

const INT_FORMAT = {} as const;

/** How many of the ranked vehicles the list markup names. Enough to describe
 * the page, short of restating the whole table. */
const RANKED_IN_SCHEMA = 50;

/**
 * The community board: every vehicle players have judged, and the two lists
 * that fall out of judging them against their own results.
 *
 * Shared body for `/tanks/community` (EU default) and its per-region copies.
 * ISR-cached like the other tank landings; the rollup behind it moves once an
 * hour, so the page being a few minutes behind costs nothing.
 */
export async function TankCommunityView({ region, locale }: { region: Region; locale: string }) {
  const { t } = await getTranslation("components/tanks/list/community/view", locale);
  const board = await buildSafe(() => unicum.region(region).tanks.ratings(), {
    results: [],
    totalVotes: 0,
    ratedTanks: 0,
    computedAt: null,
  });

  // The endpoint answers `{ identity, ...rating }`; the table wants it flat, so
  // the catalogue's own filter bar applies to it unchanged.
  const rows: CommunityBoardRow[] = board.results.map(
    ({ identity, ...rating }) => ({ ...identity, ...rating }),
  );

  // The page is a ranking, so it says so. Ordered by the same shrunk mean the
  // table opens on, capped at what a list result would ever use: an ItemList of
  // eleven hundred entries is not a list, it is the table again in JSON.
  const ranked = [...rows]
    .filter((r) => r.overallBayes != null)
    .sort((a, b) => (b.overallBayes ?? 0) - (a.overallBayes ?? 0))
    .slice(0, RANKED_IN_SCHEMA);

  return (
    <div className="mx-auto w-full max-w-7xl">
      {ranked.length > 0 ? (
        <JsonLd
          data={itemListSchema({
            name: `World of Tanks community ratings (${REGION_LABEL[region]})`,
            description:
              "World of Tanks vehicles ranked by the players who own them, best rated first.",
            items: ranked.map((r) => ({
              name: r.name,
              url: `${APP.URL}${ROUTES.TANK(region, r.slug)}/community`,
            })),
          })}
        />
      ) : null}
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            <Interpolate
              template={t("title")}
              values={{ think: <span className="text-brand">{t("think")}</span> }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("every-tank-rated-out-of")}</p>
          {board.totalVotes > 0 ? (
            <p className="mx-auto mt-3 text-sm text-fd-muted-foreground tabular-nums">
              {t("votes-across-vehicles", { totalVotes: numberFormat(locale, INT_FORMAT).format(board.totalVotes), ratedTanks: numberFormat(locale, INT_FORMAT).format(board.ratedTanks) })}</p>
          ) : null}
        </PanelContent>
      </Panel>

      {rows.length > 0 ? <Extremes locale={locale} region={region} rows={rows} /> : null}

      <PanelSeparator />

      {rows.length === 0 ? (
        <Panel>
          <PanelContent>
            <p className="text-sm text-fd-muted-foreground">
              {t("no-tank-has-been-rated")}</p>
          </PanelContent>
        </Panel>
      ) : (
        <CommunityBoard region={region} rows={rows} />
      )}
    </div>
  );
}
