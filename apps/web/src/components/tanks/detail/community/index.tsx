import { getTranslation } from "@/lib/translations.server";
import type { TankRatingSummary } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { BracketSplit } from "./brackets";
import { HypeGauge } from "./hype";
import { AxisRadar } from "./radar";
import { RatePanel } from "./rate-panel";
import { RegionSplit } from "./regions";
import { TankReviews } from "./reviews";
import { CommunityVerdict } from "./verdict";

/**
 * The Community tab: what players make of this tank, and what that verdict is
 * built on.
 *
 * The order is the argument. The headline average comes first because it is
 * what someone came for, then immediately the split by how well the voters
 * play, because on a lot of vehicles that split is the actual answer and the
 * average was the misleading part. The comparison against measured performance
 * follows, then the axes, then what people wrote.
 *
 * The form sits at the top rather than the bottom. It is the only thing on the
 * page a reader can act on, and burying it under six panels of somebody else's
 * opinions is how a community feature ends up with no community.
 */
export async function CommunityTab({
  region,
  slug,
  tankName,
  tier,
  summary, locale,
}: {
  region: Region;
  slug: string;
  tankName: string;
  tier: number;
  summary: TankRatingSummary;
  locale: string;
}) {
  const { t } = await getTranslation("components/tanks/detail/community/index", locale);
  return (
    <>
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("rate-the", { tankName })}</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <RatePanel region={region} slug={slug} tankName={tankName} />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <PanelTitle>{t("community-verdict")}</PanelTitle>
          <span className="text-xs text-fd-muted-foreground">
            {t("every-server-one-average")}</span>
        </PanelHeader>
        <PanelContent>
          <CommunityVerdict locale={locale} summary={summary} />
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
                {t("the-same-tank-by-how")}</span>
            </PanelHeader>
            <PanelContent>
              <BracketSplit brackets={summary.brackets} locale={locale} />
            </PanelContent>
          </Panel>
        </>
      ) : null}

      {summary.hype != null ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <PanelTitle>{t("reputation-against-results")}</PanelTitle>
              <span className="text-xs text-fd-muted-foreground">
                {t("opinion-next-to-win-rate", { tier })}</span>
            </PanelHeader>
            <PanelContent>
              <HypeGauge locale={locale}
                hype={summary.hype}
                perceived={summary.perceivedPercentile}
                measured={summary.measuredPercentile}
                tier={tier}
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
              <AxisRadar locale={locale} axes={summary.axes} axisVotes={summary.axisVotes} />
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
                {t("same-tank-different-metas")}</span>
            </PanelHeader>
            <PanelContent>
              <RegionSplit regions={summary.regions}  locale={locale} />
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
                is capped, so counting it would say "30 opinions" on a tank with
                three hundred, and contradict the reviewCount this same page
                publishes in its structured data. */}
              {t("opinion", { count: summary.reviewCount })}
              {summary.reviewCount > summary.reviews.length
                ? t("n-shown", { count: summary.reviews.length })
                : null}
            </span>
          ) : null}
        </PanelHeader>
        <PanelContent>
          <TankReviews locale={locale} reviews={summary.reviews} />
        </PanelContent>
      </Panel>
    </>
  );
}
