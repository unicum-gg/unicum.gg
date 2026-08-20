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
export function CommunityTab({
  region,
  slug,
  tankName,
  tier,
  summary,
}: {
  region: Region;
  slug: string;
  tankName: string;
  tier: number;
  summary: TankRatingSummary;
}) {
  return (
    <>
      <Panel>
        <PanelHeader>
          <PanelTitle>Rate the {tankName}</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <RatePanel region={region} slug={slug} tankName={tankName} />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <PanelTitle>Community verdict</PanelTitle>
          <span className="text-xs text-fd-muted-foreground">
            Every server, one average
          </span>
        </PanelHeader>
        <PanelContent>
          <CommunityVerdict summary={summary} />
        </PanelContent>
      </Panel>

      {/* Everything below only exists once there is something to say. A page of
        empty panels reads as a broken feature rather than a new one. */}
      {summary.votes > 0 ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <PanelTitle>Who is saying it</PanelTitle>
              <span className="text-xs text-fd-muted-foreground">
                The same tank, by how well the voter plays
              </span>
            </PanelHeader>
            <PanelContent>
              <BracketSplit brackets={summary.brackets} />
            </PanelContent>
          </Panel>
        </>
      ) : null}

      {summary.hype != null ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <PanelTitle>Reputation against results</PanelTitle>
              <span className="text-xs text-fd-muted-foreground">
                Opinion next to win rate, within tier {tier}
              </span>
            </PanelHeader>
            <PanelContent>
              <HypeGauge
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
              <PanelTitle>Axis by axis</PanelTitle>
            </PanelHeader>
            <PanelContent>
              <AxisRadar axes={summary.axes} axisVotes={summary.axisVotes} />
            </PanelContent>
          </Panel>
        </>
      ) : null}

      {summary.regions.filter((r) => r.votes > 0).length > 1 ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <PanelTitle>By server</PanelTitle>
              <span className="text-xs text-fd-muted-foreground">
                Same tank, different metas
              </span>
            </PanelHeader>
            <PanelContent>
              <RegionSplit regions={summary.regions} />
            </PanelContent>
          </Panel>
        </>
      ) : null}

      <PanelSeparator />
      <Panel>
        <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <PanelTitle>What players wrote</PanelTitle>
          {summary.reviewCount > 0 ? (
            <span className="text-xs text-fd-muted-foreground">
              {/* The real total, not the length of the list below it. The list
                is capped, so counting it would say "30 opinions" on a tank with
                three hundred, and contradict the reviewCount this same page
                publishes in its structured data. */}
              {summary.reviewCount}{" "}
              {summary.reviewCount === 1 ? "opinion" : "opinions"}
              {summary.reviewCount > summary.reviews.length
                ? `, ${summary.reviews.length} shown`
                : null}
            </span>
          ) : null}
        </PanelHeader>
        <PanelContent>
          <TankReviews reviews={summary.reviews} />
        </PanelContent>
      </Panel>
    </>
  );
}
