import Link from "next/link";
import { toRoman } from "roman-numerals";
import { HYPE_THRESHOLD } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { NationFlag } from "@/components/tanks/nation-flag";
import { Stars } from "@/components/tanks/detail/community/stars";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import ROUTES from "@/constants/routes";
import type { CommunityBoardRow } from "./row";

const intFmt = new Intl.NumberFormat("en-US");

/**
 * The two lists nobody else can build.
 *
 * Reputation is something every player has an opinion about and nobody
 * measures. We happen to hold both halves: what the community says about a
 * tank, and what that tank actually achieves, each ranked inside its own tier
 * so the comparison means something. Subtracting them gives the vehicles the
 * server overrates and the ones it has never given credit to.
 *
 * Given its own panel above the table rather than left as a sortable column,
 * because it is the answer to a question people already argue about, and a
 * column is not an answer, it is a thing you have to think to click.
 */

/** Votes a tank needs before it can appear in either list. The gap is a
 * comparison of two ranks, and a rank built on six opinions would put a
 * half-known vehicle at the top of a list titled "most overrated in the game". */
const MIN_VOTES = 25;
const SHOWN = 5;

export function Extremes({
  region,
  rows,
}: {
  region: Region;
  rows: CommunityBoardRow[];
}) {
  const eligible = rows.filter(
    (r) => r.hype != null && r.votes >= MIN_VOTES,
  );
  const byGap = [...eligible].sort((a, b) => (b.hype ?? 0) - (a.hype ?? 0));
  const overrated = byGap
    .filter((r) => (r.hype ?? 0) > HYPE_THRESHOLD)
    .slice(0, SHOWN);
  const underrated = byGap
    .filter((r) => (r.hype ?? 0) < -HYPE_THRESHOLD)
    .slice(-SHOWN)
    .reverse();

  if (overrated.length === 0 && underrated.length === 0) return null;

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <PanelTitle>Reputation against results</PanelTitle>
        <span className="text-xs text-fd-muted-foreground">
          Where the community and the win rate disagree most
        </span>
      </PanelHeader>
      <PanelContent className="grid gap-8 sm:grid-cols-2">
        <ExtremeList
          title="Overrated"
          subtitle="Loved far more than they win"
          region={region}
          rows={overrated}
          tone="#D77900"
        />
        <ExtremeList
          title="Underrated"
          subtitle="Win far more than anyone admits"
          region={region}
          rows={underrated}
          tone="#6D9521"
        />
      </PanelContent>
    </Panel>
  );
}

function ExtremeList({
  title,
  subtitle,
  region,
  rows,
  tone,
}: {
  title: string;
  subtitle: string;
  region: Region;
  rows: CommunityBoardRow[];
  tone: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold" style={{ color: tone }}>
          {title}
        </h3>
        <span className="text-xs text-fd-muted-foreground">{subtitle}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">
          Nothing far enough out of line yet.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-fd-border">
          {rows.map((row) => (
            <li
              key={row.tankId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0"
            >
              <NationFlag
                nation={row.nation}
                region={region}
                variant="flag"
              />
              <Link
                href={`${ROUTES.TANK(region, row.slug)}/community`}
                className="text-sm hover:underline"
              >
                {row.name}
              </Link>
              <span className="text-xs text-fd-muted-foreground tabular-nums">
                {toRoman(row.tier)}
              </span>
              <span className="ml-auto flex items-center gap-2">
                <Stars value={row.overall} size={11} />
                <span
                  className="w-10 text-right text-xs font-medium tabular-nums"
                  style={{ color: tone }}
                >
                  {(row.hype ?? 0) > 0 ? "+" : ""}
                  {((row.hype ?? 0) * 100).toFixed(0)}
                </span>
              </span>
              <span className="w-full text-right text-[11px] text-fd-muted-foreground tabular-nums sm:w-auto">
                {intFmt.format(row.votes)} votes
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
