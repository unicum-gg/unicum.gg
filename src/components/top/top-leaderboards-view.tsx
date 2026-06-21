import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { RelativeTime } from "@/components/relative-time";
import { TopClansList } from "@/components/clans/top-clans-list";
import { TopPlayersList } from "@/components/players/top-players-list";
import APP from "@/constants/app";
import { RATING_METRICS, RatingMetric } from "@/constants/rating";
import ROUTES from "@/constants/routes";
import { breadcrumbSchema, collectionPageSchema } from "@/lib/schema-org";
import { styles } from "@/lib/styles";
import {
  getTopClansByMetric,
  type TopClanResult,
} from "@/services/wargaming/wot/clans/top";
import type { TopClanByLanguageResult } from "@/services/wargaming/wot/clans/top/by-language";
import {
  getTopPlayersByMetric,
  TopPlayersPeriod,
  type TopPlayerResult,
} from "@/services/wargaming/wot/players/top";
import type { TopPlayerByLanguageResult } from "@/services/wargaming/wot/players/top/by-language";
import { Region, REGION_EMOJI, REGION_LABEL } from "@/services/wargaming/wot";

const LIMIT = 30;

/** The precomputed top tables already carry every field the list
 * components need; the language variants just add a (here empty)
 * `languages` array, so a structural widen is all that is required. */
function asPlayerRows(rows: TopPlayerResult[]): TopPlayerByLanguageResult[] {
  return rows.map((r) => ({ ...r, languages: [] }));
}

function asClanRows(rows: TopClanResult[]): TopClanByLanguageResult[] {
  return rows.map((r) => ({
    clan_id: r.clan_id,
    tag: r.tag,
    name: r.name,
    color: r.color,
    emblem: r.emblem,
    languages: [],
    members_count: r.members_count,
    rated_members_count: r.rated_members_count,
    avg_value: r.avg_wnx,
  }));
}

type MetricSnapshot = {
  results: TopPlayerResult[];
  computedAt: Date | null;
};

async function loadPlayerPeriod(
  region: Region,
  period: TopPlayersPeriod,
): Promise<Record<RatingMetric, MetricSnapshot>> {
  const entries = await Promise.all(
    RATING_METRICS.map(
      async (metric) =>
        [metric, await getTopPlayersByMetric(region, metric, period, LIMIT)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<RatingMetric, MetricSnapshot>;
}

function MetricInline() {
  return (
    <>
      <span data-rating-col="wn7">WN7</span>
      <span data-rating-col="wn8">WN8</span>
      <span data-rating-col="wnx">WNX</span>
    </>
  );
}

function PlayerPeriodPanel({
  title,
  description,
  region,
  byMetric,
}: {
  title: string;
  description: React.ReactNode;
  region: Region;
  byMetric: Record<RatingMetric, MetricSnapshot>;
}) {
  const computedAt = byMetric[RatingMetric.Wnx].computedAt;
  return (
    <Panel className="flex flex-col">
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
      </PanelHeader>
      <PanelContent className="flex-1 p-0">
        <div className={`p-4 ${styles.mutedDescription}`}>
          {description}
          {computedAt ? (
            <>
              {" "}
              Updated <RelativeTime date={computedAt} />.
            </>
          ) : null}
        </div>
        {RATING_METRICS.map((metric) => (
          <div key={metric} data-rating-col={metric}>
            <TopPlayersList
              region={region}
              results={asPlayerRows(byMetric[metric].results)}
              metric={metric}
            />
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}

/**
 * Dedicated, indexable landing for the period-based precomputed
 * leaderboards (top players over 24h / 7d / all-time and top clans).
 * The home page only previews these nine-row-deep; this page surfaces the
 * full precomputed lists with their own SEO, structured data and
 * cross-links. Region is fixed by the route so the page is fully static.
 *
 * All three rating metrics render into the HTML, gated by
 * `data-rating-col` so the same cached response serves every visitor and
 * the rating cookie only flips which one is visible.
 */
export async function TopLeaderboardsView({ region }: { region: Region }) {
  const [day, week, overall, clanWn7, clanWn8, clanWnx] = await Promise.all([
    loadPlayerPeriod(region, TopPlayersPeriod.Day),
    loadPlayerPeriod(region, TopPlayersPeriod.Week),
    loadPlayerPeriod(region, TopPlayersPeriod.Overall),
    getTopClansByMetric(region, RatingMetric.Wn7, LIMIT),
    getTopClansByMetric(region, RatingMetric.Wn8, LIMIT),
    getTopClansByMetric(region, RatingMetric.Wnx, LIMIT),
  ]);
  const clansByMetric: Record<RatingMetric, TopClanResult[]> = {
    [RatingMetric.Wn7]: clanWn7.results,
    [RatingMetric.Wn8]: clanWn8.results,
    [RatingMetric.Wnx]: clanWnx.results,
  };
  const label = REGION_LABEL[region];

  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd
        data={collectionPageSchema({
          name: `Top World of Tanks players and clans (${label})`,
          description: `${label} leaderboards: top players over the past 24 hours, 7 days and all time, plus top clans, ranked by WNX, WN8 and WN7.`,
          url: ROUTES.TOP(region),
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, path: "/" },
          { name: `Leaderboards (${label})`, path: ROUTES.TOP(region) },
        ])}
      />

      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            World of Tanks <span className="text-[#f25322]">leaderboards</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            Top {label} players over the past 24 hours, 7 days and all time,
            plus the top clans, ranked by <MetricInline />. Computed from our
            own snapshots. New to the ratings?{" "}
            <Link href={ROUTES.GLOSSARY} className={styles.linkHover}>
              Read the glossary
            </Link>
            .
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <div className="grid lg:grid-cols-3 *:min-w-0">
        <PlayerPeriodPanel
          title="Top players · Past 24 hours"
          region={region}
          byMetric={day}
          description={
            <>
              Ranked by <MetricInline /> over the past 24 hours (min. 20
              battles).
            </>
          }
        />
        <PlayerPeriodPanel
          title="Top players · Past 7 days"
          region={region}
          byMetric={week}
          description={
            <>
              Ranked by <MetricInline /> over the past 7 days (min. 140
              battles).
            </>
          }
        />
        <PlayerPeriodPanel
          title="Top players · Overall"
          region={region}
          byMetric={overall}
          description={
            <>
              Ranked by all-time <MetricInline /> (min. 20,000 battles).
            </>
          }
        />
      </div>

      <PanelSeparator />

      <Panel className="flex flex-col">
        <PanelHeader className="flex items-center justify-between gap-3">
          <PanelTitle>Top clans · {label}</PanelTitle>
          <Link href={ROUTES.CLANS(region)} className={styles.linkHover}>
            By language →
          </Link>
        </PanelHeader>
        <PanelContent className="flex-1 p-0">
          <div className={`p-4 ${styles.mutedDescription}`}>
            Clans ranked by battle-weighted average <MetricInline /> across
            their rated members.
          </div>
          {RATING_METRICS.map((metric) => (
            <div key={metric} data-rating-col={metric}>
              <TopClansList
                region={region}
                results={asClanRows(clansByMetric[metric])}
                metric={metric}
              />
            </div>
          ))}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Explore more</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href={ROUTES.PLAYERS(region)} className={styles.linkHover}>
              Players by language
            </Link>
            <Link href={ROUTES.CLANS(region)} className={styles.linkHover}>
              Clans by language
            </Link>
            <Link href={ROUTES.GLOSSARY} className={styles.linkHover}>
              Rating glossary
            </Link>
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
