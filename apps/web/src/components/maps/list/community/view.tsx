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
import { mapName } from "@/components/game-name";
import { MapCommunityTable } from "./table";
import type { MapCommunityRow } from "./row";

const INT_FORMAT = {} as const;

/**
 * The map community board: every arena players have judged.
 *
 * Shared body for `/maps/community` (EU default) and its per-region copies. ISR
 * like the other map landings, since the rollup behind it moves once an hour.
 *
 * Unpaginated by nature rather than by choice: the random pool is around fifty
 * arenas, so the whole catalogue is one page of the table and there is no
 * `/page/[n]` route for the pager to link to. The vehicle board needs all of
 * that because it holds eleven hundred rows.
 */
export async function MapCommunityView({
  region,
  locale,
}: {
  region: Region;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/maps/list/community/view",
    locale,
  );
  // Named here as well as in the table, because the structured data below is
  // rendered on the server and has to carry the same names a reader sees.
  const { t: tMaps } = await getTranslation("game/maps", locale);
  const board = await buildSafe(() => unicum.region(region).maps.ratings(), {
    results: [],
    totalVotes: 0,
    ratedMaps: 0,
    computedAt: null,
  });

  // The endpoint answers `{ identity, ...rating }`; the table wants it flat.
  // Cast like every other enum crossing the API: the payload carries the
  // camouflage as a string and a TS string enum is nominal, so the two are the
  // same characters and not the same type.
  const rows = board.results.map(({ identity, ...rating }) => ({
    ...identity,
    ...rating,
  })) as unknown as MapCommunityRow[];

  // The page is a ranking, so it says so, ordered by the same shrunk mean the
  // table opens on. Uncapped, unlike the vehicle board's: fifty entries is a
  // list, and eleven hundred would be the table again in JSON.
  const ranked = [...rows]
    .filter((r) => r.overallBayes != null)
    .sort((a, b) => (b.overallBayes ?? 0) - (a.overallBayes ?? 0));

  return (
    <div className="mx-auto w-full max-w-7xl">
      {ranked.length > 0 ? (
        <JsonLd
          data={itemListSchema({
            name: `World of Tanks map community ratings (${REGION_LABEL[region]})`,
            description:
              "World of Tanks maps ranked by the players who are sent to them, best rated first.",
            items: ranked.map((r) => ({
              name: mapName(r.arenaId, r.name, tMaps),
              url: `${APP.URL}${ROUTES.MAP(region, r.slug)}/community`,
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
            {t("every-map-rated-out-of")}
          </p>
          {board.totalVotes > 0 ? (
            <p className="mx-auto mt-3 text-sm text-fd-muted-foreground tabular-nums">
              {t("votes-across-maps", {
                totalVotes: numberFormat(locale, INT_FORMAT).format(
                  board.totalVotes,
                ),
                ratedMaps: numberFormat(locale, INT_FORMAT).format(
                  board.ratedMaps,
                ),
              })}
            </p>
          ) : null}
        </PanelContent>
      </Panel>

      {rows.length > 0 ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelContent className="p-0">
              <MapCommunityTable region={region} rows={rows} />
            </PanelContent>
          </Panel>
        </>
      ) : (
        <>
          <PanelSeparator />
          <Panel>
            <PanelContent className="px-4 py-10 text-center text-sm text-fd-muted-foreground">
              {t("nobody-has-rated-a-map-yet")}
            </PanelContent>
          </Panel>
        </>
      )}
    </div>
  );
}
