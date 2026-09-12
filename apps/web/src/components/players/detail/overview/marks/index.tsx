import { numberFormat } from "@/lib/format";
import type { PlayerMarkProgress } from "@unicum.gg/shared";
import { useTranslation } from "@/hooks/use-translation";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { MOE_COLORS, MoEIcon } from "@/components/tanks/moe-icon";
import { MoMIcon } from "@/components/tanks/mom-icon";
import { MarksMatrix, type MatrixLevel } from "./matrix";
import { MarksReach } from "./reach";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

/** Reach entries shown, split evenly across the two columns. The payload
 * carries more so a future filter has something to work with. */
const REACH_SHOWN = 6;

const MARK_LEVELS: MatrixLevel<"mark1" | "mark2" | "mark3">[] = [
  { key: "mark1", label: <MoEIcon bars={1} color={MOE_COLORS[1]} />, value: 1 },
  { key: "mark2", label: <MoEIcon bars={2} color={MOE_COLORS[2]} />, value: 2 },
  { key: "mark3", label: <MoEIcon bars={3} color={MOE_COLORS[3]} />, value: 3 },
];

const MASTERY_LEVELS: MatrixLevel<"class3" | "class2" | "class1" | "ace">[] = [
  { key: "class3", label: <MoMIcon mastery={1} className="h-4" />, value: 1 },
  { key: "class2", label: <MoMIcon mastery={2} className="h-4" />, value: 2 },
  { key: "class1", label: <MoMIcon mastery={3} className="h-4" />, value: 3 },
  { key: "ace", label: <MoMIcon mastery={4} className="h-4" />, value: 4 },
];

/**
 * Marks of Excellence and Marks of Mastery across the garage.
 *
 * One panel rather than two, laid out like the lift/drag panel above it: the
 * two counts side by side, then the vehicles worth doing something about
 * underneath, split across two columns of the same rows.
 *
 * Marks and badges sit together because they are read together and neither
 * fills a panel on its own, but only marks get the second half. Wargaming
 * publishes no per-battle base experience, and the record score it does publish
 * carries account bonuses the badge is not judged on, so no honest distance to
 * the next badge can be computed. Mastery counts what was earned and says so.
 */
export function PlayerMarksPanels({
  region,
  nickname,
  progress,
  tanksHref,
  locale,
}: {
  region: Region;
  nickname: string;
  progress: PlayerMarkProgress;
  tanksHref: string;
  locale: string;
}) {
  const { garage, marks, mastery, reach } = progress;
  const markedVehicles =
    marks.total.mark1 + marks.total.mark2 + marks.total.mark3;
  // Balanced across the two columns rather than filling the first: three rows
  // read as two and one otherwise.
  const shown = reach.slice(0, REACH_SHOWN);
  const half = Math.ceil(shown.length / 2);
  const shownReach = { left: shown.slice(0, half), right: shown.slice(half) };
  const { t } = useTranslation(
    "components/players/detail/overview/marks/index",
  );
  const hasMarks = marks.byTier.length > 0;
  const hasMastery = mastery.byTier.length > 0;
  if (!hasMarks && !hasMastery) return null;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{t("title", { nickname })}</PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <div className="grid gap-px bg-fd-border md:grid-cols-2">
          {hasMarks && (
            <Column
              title={t("excellence.title")}
              description={t("excellence.description")}
              totals={
                <>
                  <Total count={marks.total.mark1} bars={1}  locale={locale} />
                  <Total count={marks.total.mark2} bars={2}  locale={locale} />
                  <Total count={marks.total.mark3} bars={3}  locale={locale} />
                </>
              }
            >
              <MarksMatrix
                region={region}
                nickname={nickname}
                tanksHref={tanksHref}
                param="moe"
                levelOf={(t) => t.moe}
                rows={marks.byTier.map((r) => ({
                  tier: r.tier,
                  total: r.total,
                  counts: {
                    none: r.none,
                    mark1: r.mark1,
                    mark2: r.mark2,
                    mark3: r.mark3,
                  },
                }))}
                levels={MARK_LEVELS}
                emptyLabel={t("none")}
              />
              {/* Closes the table, which drops its own last border so that
                  whatever follows draws the line, and answers the same question
                  the mastery column answers underneath its own. Marks ride the
                  WoT portal rather than the public API, so a garage we have only
                  partly reached says so here instead of letting the gap read as
                  "no mark". */}
              <p className="mt-auto border-t border-fd-border px-4 py-2 text-sm text-fd-muted-foreground">
                {marks.known < garage
                  ? t("excellence.partial", {
                      known: numberFormat(locale, INT_FORMAT).format(marks.known),
                      garage: numberFormat(locale, INT_FORMAT).format(garage),
                    })
                  : t(
                      garage > 0
                        ? "excellence.note-share"
                        : "excellence.note",
                      {
                        marked: numberFormat(locale, INT_FORMAT).format(markedVehicles),
                        garage: numberFormat(locale, INT_FORMAT).format(garage),
                        percent: Math.round((markedVehicles / garage) * 100),
                      },
                    )}
              </p>
            </Column>
          )}

          {hasMastery && (
            <Column
              title={t("mastery.title")}
              description={t("mastery.description")}
              totals={
                <>
                  <MasteryTotal count={mastery.total.class3} mastery={1}  locale={locale} />
                  <MasteryTotal count={mastery.total.class2} mastery={2}  locale={locale} />
                  <MasteryTotal count={mastery.total.class1} mastery={3}  locale={locale} />
                  <MasteryTotal count={mastery.total.ace} mastery={4}  locale={locale} />
                </>
              }
            >
              <MarksMatrix
                region={region}
                nickname={nickname}
                tanksHref={tanksHref}
                param="mom"
                levelOf={(t) => t.mom}
                rows={mastery.byTier.map((r) => ({
                  tier: r.tier,
                  total: r.total,
                  counts: {
                    none: r.none,
                    class3: r.class3,
                    class2: r.class2,
                    class1: r.class1,
                    ace: r.ace,
                  },
                }))}
                levels={MASTERY_LEVELS}
                emptyLabel={t("none")}
              />
              <p className="mt-auto border-t border-fd-border px-4 py-2 text-sm text-fd-muted-foreground">
                {t(garage > 0 ? "mastery.note-share" : "mastery.note", {
                  aces: numberFormat(locale, INT_FORMAT).format(mastery.total.ace),
                  garage: numberFormat(locale, INT_FORMAT).format(garage),
                  percent: Math.round((mastery.total.ace / garage) * 100),
                })}
              </p>
            </Column>
          )}
        </div>

        {/* Below the two counts rather than inside one of them: it is about
            both halves of the panel's subject, and split in two like the
            lift/drag rows so a name and its number are never an inch apart. */}
        {hasMarks && reach.length > 0 && (
          <div className="border-t border-fd-border">
            <div className="px-4 py-2">
              <span className="text-sm font-semibold">
                {t("reach.heading")}
              </span>
              <p className="mt-0.5 text-xs text-fd-muted-foreground">
                {t("reach.description")}
              </p>
            </div>
            <div className="grid gap-px border-t border-fd-border bg-fd-border md:grid-cols-2">
              <div className="bg-fd-card">
                <MarksReach region={region} entries={shownReach.left}  locale={locale} />
              </div>
              {/* Only once there is something to put in it: a fixed half would
                  print the empty state beside a populated column whenever the
                  list holds fewer than two rows. */}
              {shownReach.right.length > 0 && (
                <div className="bg-fd-card">
                  <MarksReach region={region} entries={shownReach.right}  locale={locale} />
                </div>
              )}
            </div>
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}

/** One half of the panel: the lift/drag column header (title, totals, grey
 * description) over whatever the half holds. */
function Column({
  title,
  description,
  totals,
  children,
}: {
  title: string;
  description: string;
  totals: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // A column, so the closing note can be pushed to the bottom: marks have
    // four levels and badges five, and without this the two notes sat at
    // different heights across the panel's divide.
    <div className="flex flex-col bg-fd-card">
      <div className="border-b border-fd-border px-4 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <span className="flex items-center gap-2.5 text-xs tabular-nums text-fd-muted-foreground">
            {totals}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-fd-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Total({ count, bars, locale }: { count: number; bars: 1| 2 | 3 ; locale: string }) {
  return (
    <span className="flex items-center gap-1">
      {numberFormat(locale, INT_FORMAT).format(count)}
      <MoEIcon bars={bars} color={MOE_COLORS[bars]} />
    </span>
  );
}

function MasteryTotal({
  count,
  mastery,
  locale,
}: {
  count: number;
  mastery: 1 | 2 | 3 | 4;
  locale: string;
}) {
  return (
    <span className="flex items-center gap-1">
      {numberFormat(locale, INT_FORMAT).format(count)}
      <MoMIcon mastery={mastery} className="h-3.5" />
    </span>
  );
}
