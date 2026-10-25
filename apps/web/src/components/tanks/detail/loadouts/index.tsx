import {
  isConfidentSample,
  LoadoutMode,
  MIN_ROW_PERFORMANCE_SAMPLE,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { RatingFallbackNote } from "@/components/rating-fallback-note";
import { RatingFallbackReason } from "@/components/rating-fallback-reason";
import { getTranslation } from "@/lib/translations.server";
import { buildViews } from "./build-views";
import { LoadoutsEmpty } from "./empty";
import { LoadoutFamilies } from "./families";
import { loadoutNaming, type LoadoutNaming } from "./naming";
import { SampleNote } from "./sample-note";
import { TopBattles } from "./top-battles";
import { TopPlayers } from "./top-players";
import { LoadoutsSwitch } from "./view-switch";
import type { TankLoadoutModeView, TankLoadoutsPayload } from "./view";

/**
 * The Loadouts tab: what this vehicle's owners have actually put on it.
 *
 * Nothing else on the site could answer this and nothing else on the internet
 * does. Wargaming publishes what a tank is capable of and never what anybody
 * fitted to it, so every figure here exists because players chose to share it
 * through the mod. That also sets the tone the whole tab is written in: these
 * are counts of real people, there are not many of them yet, and a share is
 * never shown without the sample it came from.
 *
 * Every figure comes from battles: what was fitted in each recorded Random
 * battle of the last ninety days, beside that battle's own result. Never from
 * the garage, which says what is mounted today beside a record earned under
 * whatever was mounted then.
 *
 * Three blocks, in the order a reader uses them. The table first, because the
 * build is what somebody came to copy. The crew after it, since skills are a
 * different kind of answer and do not belong in the same columns. Then the best
 * battles with exactly what was fitted for each, which is the part worth
 * reading once the averages have been.
 */
/** Where each mode's name is read in `game/vocabulary`: the game's own words,
 * in the reader's language, as the profile's mode tabs already name them. */
const MODE_NAME_KEY: Record<LoadoutMode, string> = {
  [LoadoutMode.Random]: "player-modes.overall",
  [LoadoutMode.Onslaught]: "player-modes.onslaught",
  [LoadoutMode.Skirmish]: "player-modes.skirmish",
  [LoadoutMode.Advance]: "player-modes.advances",
};

export async function LoadoutsTab({
  region,
  slug,
  tankId,
  tankName,
  modes,
  locale,
}: {
  region: Region;
  /** The vehicle's canonical slug, which links each listed player to their
   * own page on this vehicle. */
  slug: string;
  tankId: number;
  tankName: string;
  /** Every mode with battles. */
  modes: TankLoadoutModeView[];
  locale: string;
}) {
  const [{ t }, { t: tGame }] = await Promise.all([
    getTranslation("components/tanks/detail/loadouts/index", locale),
    getTranslation("game/vocabulary", locale),
  ]);
  const held = modes.filter((view) => view.stats.sample > 0);

  // Nobody has recorded a battle in this vehicle. That is the common case today
  // and it is not an error state: it is where the mod gets explained to
  // somebody who has just discovered what it would show them.
  if (held.length === 0) {
    return <LoadoutsEmpty tankName={tankName} locale={locale} />;
  }

  const naming = await loadoutNaming(region, tankId, locale);

  // Opened on the mode the most players have played it in, which is where the
  // figures are steadiest. A tie keeps the switch's own order, so Random wins
  // it.
  const initial = held.reduce(
    (best, view, index) =>
      view.stats.sample > held[best]!.stats.sample
        ? index
        : best,
    0,
  );

  return (
    <LoadoutsSwitch
      title={t("title", { tank: tankName })}
      initial={initial}
      modes={held.map((view) => {
        const modeName = tGame(MODE_NAME_KEY[view.mode]);
        return {
          label: modeName,
          players: view.stats.sample,
          note: (
            <>
              <SampleNote stats={view.stats} modeName={modeName} locale={locale} />
              <RatingFallbackNote
                reason={RatingFallbackReason.Vehicle}
                className="mt-1"
              />
            </>
          ),
          panel: (
            <ModePanels
              key={view.mode}
              region={region}
              slug={slug}
              naming={naming}
              stats={view.stats}
              t={t}
            />
          ),
        };
      })}
    />
  );
}

/** Every panel, for one mode. Split out so the switch above can render each
 * mode's set without the tab's own heading being duplicated with it. */
async function ModePanels({
  region,
  slug,
  naming,
  stats,
  t,
}: {
  region: Region;
  slug: string;
  naming: LoadoutNaming;
  stats: TankLoadoutsPayload;
  t: Awaited<ReturnType<typeof getTranslation>>["t"];
}) {
  const views = buildViews(stats, naming);
  // One table, drawn by both panels, so the columns read the same in each.
  const labels = {
    build: t("col.build"),
    usage: t("col.usage"),
    battles: t("col.battles"),
    damage: t("col.damage"),
    assist: t("col.assisted"),
    winrate: t("col.winrate"),
    playerWinrate: t("col.player-winrate"),
    delta: t("col.delta"),
    // Filled per metric by the table, which knows which column it is.
    playerRating: t("col.player-rating", { metric: "{metric}" }),
    deltaTip: t("col.delta-tip"),
    playerWinrateTip: t("col.player-winrate-tip"),
    playerRatingTip: t("col.player-rating-tip"),
    usageTip: t("col.usage-tip"),
    thin: t("thin-row", { count: MIN_ROW_PERFORMANCE_SAMPLE }),
  };

  return (
    <>
      <LoadoutFamilies
        title={t("what-they-fit")}
        families={[
          {
            id: "equipment",
            label: t("equipment"),
            description: t("counted.equipment"),
            rows: views.equipment,
          },
          {
            id: "consumables",
            label: t("consumables"),
            description: t("counted.consumables"),
            rows: views.consumables,
          },
          {
            id: "directives",
            label: t("directives"),
            description: t("counted.directives"),
            rows: views.directives,
          },
          {
            id: "field-mods",
            label: t("field-mods"),
            description: t("counted.field-mods"),
            rows: views.fieldMods,
          },
        ]}
        sample={stats.sample}
        confident={isConfidentSample(stats.sample)}
        labels={labels}
      />

      {views.crew.length > 0 ? (
        <>
          <PanelSeparator />
          <LoadoutFamilies
            title={t("crew-skills")}
            families={views.crew.map((seat) => ({
              id: seat.role,
              label: seat.roleLabel,
              description: t("crew-skills-hint", { role: seat.roleLabel }),
              rows: seat.rows,
              sample: seat.crews,
              icon: seat.roleImage,
            }))}
            sample={stats.sample}
            confident={isConfidentSample(stats.sample)}
            labels={{ ...labels, build: t("col.skill") }}
          />
        </>
      ) : null}

      {views.topPlayers.length > 0 ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{t("top-players")}</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <p className="px-4 py-3 text-sm text-fd-muted-foreground">
                {t("top-players-hint")}
              </p>
              <TopPlayers
                slug={slug}
                rows={views.topPlayers}
                labels={{
                  player: t("col.player"),
                  build: t("col.build"),
                  battles: t("col.battles"),
                  damage: t("col.damage"),
                  winrate: t("col.winrate"),
                  crew: t("crew"),
                  showCrew: t("show-crew"),
                }}
              />
            </PanelContent>
          </Panel>
        </>
      ) : null}

      {views.topBattles.length > 0 ? (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{t("top-battles")}</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <p className="border-b border-fd-border px-4 py-3 text-sm text-fd-muted-foreground">
                {t("top-battles-hint")}
              </p>
              <TopBattles region={region} slug={slug} rows={views.topBattles} />
            </PanelContent>
          </Panel>
        </>
      ) : null}
    </>
  );
}
