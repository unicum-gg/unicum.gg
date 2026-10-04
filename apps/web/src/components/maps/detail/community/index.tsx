import { getTranslation } from "@/lib/translations.server";
import { drawableMapAxes, type MapRatingSummary } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  BracketEvidence,
  BracketSplit,
} from "@/components/tanks/detail/community/brackets";
import { AxisRadar } from "@/components/tanks/detail/community/radar";
import { RegionSplit } from "@/components/tanks/detail/community/regions";
import { MapCommunityVerdict } from "./verdict";
import { MapRatePanel } from "./rate-panel";
import { MapReviews } from "./reviews";

/**
 * What players make of this map, and what that verdict is built on.
 *
 * The same machinery as the vehicle Community tab, and most of it is literally
 * the same components: the bracket split, the server split and the radar are
 * imported rather than copied, exactly as this page's video panel already
 * imports the vehicle video card. What is the map's own is the vocabulary (five
 * axes about ground rather than seven about a gun) and the evidence a verdict
 * is signed with.
 *
 * The order is the argument, and it is the vehicle tab's. The headline average
 * comes first because it is what someone came for, then immediately the split
 * by how well the voters play, because on a lot of maps that split IS the
 * answer and the average was the misleading part: an open field reads as
 * miserable from one end of the ladder and as the best ground in the game from
 * the other.
 *
 * The form sits at the top rather than the bottom. It is the only thing here a
 * reader can act on, and burying it under four panels of somebody else's
 * opinions is how a community feature ends up with no community.
 *
 * One verdict per map, not per variant. A map's Waffenträger reskin and its
 * Onslaught night version are views of it rather than maps beside it and they
 * share this page, so they share its rating: the panel asks what players make
 * of this map, and the page is the map.
 */
export async function MapCommunityPanel({
  region,
  slug,
  mapName,
  summary,
  locale,
}: {
  region: Region;
  slug: string;
  /** Wargaming's own name for the arena, in the reader's language, as the page
   * has already resolved it. */
  mapName: string;
  summary: MapRatingSummary;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/maps/detail/community/index",
    locale,
  );
  const { t: tLabel } = await getTranslation("components/labels", locale);
  // The axes are named here rather than inside the radar: the chart is pure
  // geometry and is shared with the vehicle ratings, whose axes come from a
  // different catalogue.
  const spokes = drawableMapAxes(summary.axes).map((axis) => ({
    key: axis.axis,
    label: tLabel(`map-rating-axes.${axis.axis}`),
    short: tLabel(`map-rating-axes-short.${axis.axis}`),
    value: axis.value ?? 0,
  }));

  return (
    <>
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("rate-the", { mapName })}</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <MapRatePanel region={region} slug={slug} mapName={mapName} />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <PanelTitle>{t("community-verdict")}</PanelTitle>
          <span className="text-xs text-fd-muted-foreground">
            {t("every-server-one-average")}
          </span>
        </PanelHeader>
        <PanelContent>
          <MapCommunityVerdict locale={locale} summary={summary} />
        </PanelContent>
      </Panel>

      {/* Everything below only exists once there is something to say. A page of
        empty panels reads as a broken feature rather than a new one. */}
      {summary.votes > 0 ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <PanelTitle>{t("who-is-saying-it")}</PanelTitle>
              <span className="text-xs text-fd-muted-foreground">
                {t("the-same-map-by-how")}
              </span>
            </PanelHeader>
            <PanelContent>
              {/* The slice is weighed by whether its voters are still playing,
                not by battles on the map: that figure exists nowhere. */}
              <BracketSplit
                brackets={summary.brackets}
                locale={locale}
                evidence={BracketEvidence.RecentBattles}
              />
            </PanelContent>
          </Panel>
        </>
      ) : null}

      {summary.votes > 0 ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{t("axis-by-axis")}</PanelTitle>
            </PanelHeader>
            <PanelContent>
              <AxisRadar
                locale={locale}
                spokes={spokes}
                axisVotes={summary.axisVotes}
              />
            </PanelContent>
          </Panel>
        </>
      ) : null}

      {summary.regions.filter((r) => r.votes > 0).length > 1 ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <PanelTitle>{t("by-server")}</PanelTitle>
              <span className="text-xs text-fd-muted-foreground">
                {t("same-map-different-metas")}
              </span>
            </PanelHeader>
            <PanelContent>
              <RegionSplit regions={summary.regions} locale={locale} />
            </PanelContent>
          </Panel>
        </>
      ) : null}

      <PanelSeparator />
      <Panel>
        <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <PanelTitle>{t("what-players-wrote")}</PanelTitle>
          {summary.reviewCount > 0 ? (
            <span className="text-xs text-fd-muted-foreground">
              {/* The real total, not the length of the list below it. The list
                is capped, so counting it would say "30 opinions" on a map with
                three hundred. */}
              {t("opinion", { count: summary.reviewCount })}
              {summary.reviewCount > summary.reviews.length
                ? t("n-shown", { count: summary.reviews.length })
                : null}
            </span>
          ) : null}
        </PanelHeader>
        <PanelContent>
          <MapReviews locale={locale} reviews={summary.reviews} />
        </PanelContent>
      </Panel>
    </>
  );
}
